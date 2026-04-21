require('dotenv').config();
const OpenAI = require('openai');
const { runQuery } = require("../services/db.service");
const { getConversationTitle, getChatById } = require("../services/chatDb.service");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateSQL(question) {
    try {
        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: //ADDED SOME RULES
`
You are a SQL assistant for a Warehouse Management System (WMS) used by a cold storage company.

Your job is to convert natural language questions into SQL SELECT queries.

CONTEXT INTERPRETATION — Before generating SQL, identify what the user is really asking:
- WHO   = customer, staff, driver, checker columns
- WHAT  = ItemCode, product, SKU columns
- WHERE = WarehouseCode, Location columns
- WHEN  = DocDate, AddedDate, PostedDate date columns
- HOW MANY = COUNT or SUM aggregation
- SHOW / LIST = SELECT TOP 10 query

CONVERSATION MEMORY — You may receive previous conversation history. Use it to:
- Understand follow-up questions like "show me more of those" or "filter by that customer"
- Carry forward context like document numbers, item codes, or date ranges mentioned earlier
- Resolve pronouns like "it", "that", "those" using prior context

LANGUAGE MAPPING — Map these common user terms to the correct table/column:
- "stock", "inventory", "items on hand", "on-hand"         → WMS.CountSheetSetup
- "receiving", "arrivals", "deliveries in", "ICN"           → WMS.Inbound
- "dispatch", "releasing", "deliveries out", "OCN"          → WMS.Outbound
- "received items", "inbound items", "ICN line items"        → WMS.InboundDetail
- "dispatched items", "outbound items", "OCN line items"     → WMS.OutboundDetail
- "client", "company", "account"                            → CustomerCode (Inbound) or Customer (Outbound/OutboundDetail) or CustomerC (CountSheetSetup)
- "product", "SKU", "item", "goods"                         → ItemCode column
- "expiry", "expiration", "expires"                         → ExpirationDate (CountSheetSetup) or ExpiryDate (InboundDetail/OutboundDetail)
- "location", "bin", "where is", "aisle"                    → Location column
- "pallet"                                                  → PalletID column
- "batch", "lot"                                            → BatchNumber column
- "warehouse", "facility", "cold storage"                   → WarehouseCode column
- "status", "state"                                         → Status column
- "today"                                                   → CAST(DocDate AS DATE) = CAST(GETDATE() AS DATE)
- "this month"                                              → MONTH(DocDate) = MONTH(GETDATE()) AND YEAR(DocDate) = YEAR(GETDATE())
- "this year"                                               → YEAR(DocDate) = YEAR(GETDATE())
- "posted"                                                  → Status = 'Posted'
- "how many"                                                → COUNT(*) or SUM() aggregation
- "show me", "list", "give me"                              → SELECT TOP 10

FORECASTING QUERIES — When the question involves forecasting or trends:
- Always use GROUP BY MONTH(DocDate), YEAR(DocDate) to aggregate data
- Always use COUNT(*) or SUM() to get totals per period
- Always ORDER BY YEAR(DocDate), MONTH(DocDate) to show chronological trend
- Fetch at least 3-6 months of historical data to establish a trend
- Example: SELECT YEAR(DocDate) AS Year, MONTH(DocDate) AS Month, COUNT(*) AS Total FROM WMS.Inbound WHERE DocDate >= DATEADD(MONTH, -6, GETDATE()) GROUP BY YEAR(DocDate), MONTH(DocDate) ORDER BY YEAR(DocDate), MONTH(DocDate)


Rules:
- Only generate SELECT queries.
- Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, MERGE, EXEC.
- Use SQL Server syntax only.
- Never use multiple statements.
- When limiting results, use SELECT TOP 10 (not LIMIT).
- TOP and DISTINCT cannot be used together. Use only TOP or only DISTINCT, never both.
- NEVER use SELECT *. Always specify column names explicitly.
- NEVER use UNION, UNION ALL, INTERSECT, or EXCEPT across tables with different column structures.
- NEVER assume column names. Only use columns that are explicitly listed in the schema.
- If the user asks a broad question covering multiple tables (e.g. "all transactions"), default to WMS.Inbound as the primary table. Do not use UNION to combine tables.
- NEVER invent or shorten column names. DocNumber is DocNumber, not IDocNumber or ID.
- NEVER select a column called ID — it does not exist in any table.
- Use only the provided schema.
- Do not assume columns or tables that are not listed.
- If a requested column does not exist in the primary table, JOIN the related table using the defined relationships below.
- No explanations.
- No markdown.
- If the question is completely unrelated to warehouse operations, respond using the invalid format below.

JOINING RULES:
- You may JOIN tables using the relationships defined below the schema.
- When joining tables, always prefix ALL column names with their table alias (e.g., O.DocNumber, OD.ItemCode). Never use bare column names in JOIN queries.
- If a requested column does not exist in the primary table, check other tables and JOIN accordingly instead of querying the wrong table.

Database Schema:

Table: WMS.CountSheetSetup (Also known as: inventory, countsheet, count sheet, stock, items on hand, on-hand)
RecordId - Unique row identifier
TransType - Transaction type code
TransDoc - Source document number
TransLine - Line number within the transaction
LineNumber - Sequential line number of this record
ItemCode - Product identifier code
ColorCode - Color variant code
ClassCode - Classification code
SizeCode - Size variant code
PalletID - Pallet identifier
BatchNumber - Batch or lot number
Location - Warehouse aisle/bin location code
ExpirationDate - Item expiry date
MfgDate - Manufacturing date
RRdate - Receiving report date
OriginalBulkQty - Bulk quantity when first recorded
OriginalBaseQty - Base quantity when first recorded
OriginalLocation - Aisle/bin location before any movement
RemainingBulkQty - Current available quantity
RemainingBaseQty - Current available weight
PickedBulkQty - Picked available quantity
PickedBaseQty - Picked available weight
ReservedBulkQty - Bulk quantity reserved for outbound
ReservedBaseQty - Base quantity reserved for outbound
OriginalCost - Item cost at receiving
UnitCost - Current cost per unit
Field1 - Custom spare field 1
Field2 - Custom spare field 2
Field3 - Lot ID
Field4 - Custom spare field 4
Field5 - Custom spare field 5
Field6 - Custom spare field 6
Field7 - Custom spare field 7
Field8 - Custom spare field 8
Field9 - Custom spare field 9
RefTransType - Referenced source transaction type
RefTransDoc - Referenced source document number
RefTransLine - Referenced source line number
RefLineNumber - Referenced source sub-line number
AddedBy - User who created the record
AddedDate - Record creation date
LastEditedBy - User who last modified the record
LastEditedDate - Date of last modification
BarcodeNo - Assigned barcode number
SubmittedDate - Date submitted for processing
PutawayDate - Date placed in storage location
WarehouseCode - Warehouse facility code
PalletPicking - Pallet-level picking flag
ReceivingFindings - Inspection notes from receiving
CustomerC - Customer code who owns the inventory
HoldStatus - Current hold status
AllocatedQty - Quantity allocated to outbound
AllocatedKilo - Weight allocated to outbound
AllocatedDoc - Outbound document for this allocation
BatchComi - Batch commingling reference
ComiRef - Commingling reference code
OriginalTransdoc - Original document before modification
OriginalTransLine - Original line before modification

Table: WMS.Inbound (Also known as: receiving, deliveries in, ICN, incoming shipments, arrivals, inbound transactions)
DocNumber - Unique inbound document number
CustomerCode - Owner customer code
WarehouseCode - Receiving warehouse facility code
DocDate - Document creation date
ICNNumber - Inbound control number
TranType - Inbound transaction mode
Plant - Handling plant or contractor name
RoomCode - Cold storage room assigned
DRNumber - Delivery receipt number
ContainerTemp - Container temperature on arrival
Driver - Delivery driver name or N/A
ContainerNo - Container identifier
ContactingDept - Coordinating department
InvoiceNo - Supplier invoice number
PlateNo - Vehicle plate number or N/A
SealNo - Container seal number
Supplier - Supplier or shipper name
AWB - Air waybill number
Trucker - Trucking company name
DocumentationStaff - Documentation handler
WarehouseChecker - Checker who inspected goods
GuardOnDuty - Security guard during receiving
CustomerRepresentative - Customer rep present at receiving
ApprovingOfficer - Officer who approved the inbound
Arrival - Shipment arrival date and time
Departure - Vehicle departure date and time
StartUnload - Unloading start date and time
CompleteUnload - Unloading completion date and time
PutAwayBy - Numeric user ID who performed put-away
PutAwayDate - Put-away completion date
PutAwayStrategy - Put-away strategy applied
IsNoCharge - Free of charge flag
Packing - Packing type or method
AssignLoc - Assigned storage zone
ICNTotalQty - Total quantity received (use this, NOT TotalQty)
AddedBy - Numeric user ID who created the record
AddedDate - Record creation date
LastEditedBy - User who last modified the record
LastEditedDate - Date of last modification
SubmittedBy - User who submitted the document
SubmittedDate - Document submission date
PostedBy - User who posted the document
PostedDate - Document posting date
IsValidated - Validation flag
IsWithDetail - Line item details exist flag
Field1 - Custom spare field 1
Field2 - Custom spare field 2
Field3 - Custom spare field 3
Field4 - Custom spare field 4
Field5 - Custom spare field 5
Field6 - Custom spare field 6
Field7 - Custom spare field 7
Field8 - Custom spare field 8
Field9 - Custom spare field 9
ApprovedBy - User who approved the document
ApprovedDate - Approval date
IsPrinted - Printed flag
GeneratedDate - System generation date
PrintCount - Number of times printed
ProdNumber - Production order number
StorageType - Storage temperature type
IsService - Service transaction integer flag
DirectOutbound - Direct transfer to outbound integer flag
WeekNo - Week number for scheduling
TruckNo - Truck identifier
Remarks - General notes
UserId - System user ID
AcceptBy - User who accepted the document
AcceptDate - Acceptance date
RejectBy - User who rejected the document
RejectDate - Rejection date
CheckerAssignedDate - Date checker was assigned
RFPutAwayBy - RF user who performed put-away
RFPutAwayDate - RF put-away date
DeliveryDate - Delivery date
DockingTime - Vehicle docking time
CheckingStart - Goods checking start date and time
CheckingEnd - Goods checking end date and time
EndProcessing - Processing end date and time
StartProcessing - Processing start date and time
HoldReason - Reason for hold
HoldRemarks - Additional hold remarks
HoldDate - Date hold was applied
UnHoldDate - Date hold was lifted
HoldDuration - Duration of hold
HoldStatus - Current hold status
Status - Current document status
CheckedBy - User who performed physical check
InternalExternal - Internal or external transaction
LoadingBay - Loading bay number used
AuthorizeBy - User who authorized the transaction
DwellTime - Total vehicle time at facility
DocumentBy - User responsible for documentation
CancelledBy - User who cancelled the document
CancelledDate - Cancellation date
CompleteUnloadBY - User who completed unloading
CheckerTransact - Checker for this transaction
BlastReq - Blast freezing requested flag
TDRnumber - Temperature deviation report number
TDocumentedBy - Temperature records documenter
Tdocument - Temperature document reference
TOrderFullfilment - Temperature order fulfillment reference
Tremarks - Temperature remarks
BlastedBy - User who performed blast freezing
BlastedDate - Blast freezing date
CleanInvoice - Invoice verified flag
TruckerRepresentative - Trucking company representative
AfterBlastBy - User who handled goods after blasting
AfterBlastedDate - After-blast handling completion date
HandlingInPt - Handling instructions at entry point
ArrivedBy - User who recorded arrival
ICNPortalCreatedDate - ICN portal creation date
ICNPortalSubmitted - ICN portal submission flag or date
ResetBy - User who reset the document
ResetDate - Document reset date
PutAwayStatus - Current put-away status
UncancelledDate - Cancellation reversal date
UncancelledBy - User who reversed cancellation
ImportedDate - Record import date
NonConformance - Non-conformance found flag
NCR - Non-conformance report number
Stripping - Container stripping flag
Sorting - Sorting required flag
RowVer - Row version for concurrency control
IsTruckMonitored - Truck temperature monitoring flag

Table: WMS.Outbound (Also known as: dispatch, releasing, OCN, outgoing shipments, deliveries out, outbound transactions)
DocNumber - Unique outbound document number
DocDate - Document creation date
WarehouseCode - Dispatching warehouse facility code
Customer - Customer code for the outbound
TargetDate - Target dispatch or delivery date
IsNoCharge - Free of charge flag
DeliverTo - Delivery destination name
DeliveryAddress - Full delivery address
TruckingCo - Trucking company name
PlateNumber - Vehicle plate number or N/A
Driver - Driver name or N/A
WarehouseChecker - Checker who inspected outbound goods
DocumentStaff - Documentation handler
StartLoading - Loading start date and time
CompleteLoading - Loading completion date and time
ContainerNumber - Container identifier
SealNumber - Container seal number
OtherReference - Additional reference number
AddedBy - Numeric user ID who created the record
AddedDate - Record creation date
LastEditedBy - User who last modified the record
LastEditedDate - Date of last modification
SubmittedBy - User who submitted the document
SubmittedDate - Document submission date
PostedBy - User who posted the document
PostedDate - Document posting date
IsValidated - Validation flag
IsWithDetail - Line item details exist flag
Field1 - Custom spare field 1
Field2 - Custom spare field 2
Field3 - Custom spare field 3
Field4 - Custom spare field 4
Field5 - Custom spare field 5
Field6 - Custom spare field 6
Field7 - Custom spare field 7
Field8 - Custom spare field 8
Field9 - Custom spare field 9
SetBox - Number of set boxes
NetWeight - Net shipment weight
NetVolume - Net shipment volume
SMDeptSub - Sales department subdivision reference
ModeofPayment - Payment mode
ModeofShipment - Shipment mode
Brand - Brand name of dispatched goods
TotalAmount - Total declared monetary value
DeclaredValue - Declared value for insurance or customs
TotalQty - Total quantity in document
ForwarderTR - Freight forwarder tracking reference
WayBillRemarks - Waybill remarks
WayBillDate - Waybill date
IsPrinted - Printed flag
PrintCount - Number of times printed
AllocationDate - Goods allocation date
StorageType - Storage temperature type
AcceptBy - User who accepted the document
AcceptDate - Acceptance date
RejectBy - User who rejected the document
RejectDate - Rejection date
CheckerAssignedDate - Date checker was assigned
RFCheckBy - RF user who performed check
RFCheckDate - RF check date
ArrivalTime - Truck arrival time
DockingTime - Truck docking time
CheckingStart - Checking start date and time
CheckingEnd - Checking end date and time
StartProcessing - Processing start date and time
EndProcessing - Processing end date and time
DepartureTime - Truck departure time
HoldReason - Reason for hold
HoldRemarks - Additional hold remarks
HoldDate - Date hold was applied
UnHoldDate - Date hold was lifted
HoldDuration - Duration of hold
Status - Current document status
HoldStatus - Current hold status
CheckedBy - User who performed physical check
InternalExternal - Internal or external transaction
LoadingBay - Loading bay number used
Consignee - Consignee name
Overtime - Overtime indicator
ConsigneeAddress - Consignee address
AddtionalManpower - Additional manpower indicator
SuppliedBy - Manpower or resource supplier
NOManpower - Number of manpower assigned
TruckProviderByMets - Truck provider name or indicator
TrackingNO - Shipment tracking number
CompanyDept - Requesting company department
ShipmentType - Free-text shipment type description
RefDoc - Reference document number
TruckType - Truck type
DwellTime - Total truck time at facility
ApprovingOfficer - Approving officer
CheckerTransact - Checker for this transaction
CancelledBy - User who cancelled the document
CancelledDate - Cancellation date
Remarksout - Outbound-specific remarks
TDRnumber - Temperature deviation report number
TDocumentedBy - Temperature records documenter
Tdocument - Temperature document reference
TOrderFullfilment - Temperature order fulfillment reference
Tremarks - Temperature remarks
HIHO - High In High Out handling flag
CleanInvoice - Invoice verified flag
TruckerRepresentative - Trucking company representative
ArrivedBy - User who recorded truck arrival
OCNPortalCreatedDate - OCN portal creation date
OCNPortalSubmitted - OCN portal submission flag or date
PickToLoad - Pick-to-load process flag
MTV - Motorized transport vehicle reference
IsDistri - Distribution order flag
UncancelledBy - User who reversed cancellation
UncancelledDate - Cancellation reversal date
UncancelledFrom - Status before reversal
CancelledFrom - Status at time of cancellation
SONumber - Linked sales order number
OutletHead - Head of receiving outlet
Notes - General notes
Wave - Wave number for batch picking
IsLead - Lead outbound document flag
IsWave - Wave picking flag
ContainNum - Container count

Table: WMS.InboundDetail (Also known as: received items, inbound items, inbound line items, ICN details, ICN items)
DocNumber - Parent inbound document number
LineNumber - Line number in the document
ItemCode - Product identifier code
ColorCode - Color variant code
ClassCode - Classification code
SizeCode - Size variant code
BulkQty - Expected bulk quantity
BulkUnit - Bulk unit of measure
ReceivedQty - Actual received quantity
Unit - Base unit of measure
ExpiryDate - Item expiry date
BatchNumber - Batch ID or damage notation
ManufacturingDate - Manufacturing date
ToLocation - Lot reference or destination bin
PalletID - Assigned pallet identifier
LotID - Lot identifier for traceability
RRDocDate - Receiving report document date
PickedQty - Quantity picked from this line
Remarks - Line item notes
BaseQty - Quantity in base units
StatusCode - String status code
BarcodeNo - Item or pallet barcode
Field1 - Custom spare field 1
Field2 - Custom spare field 2
Field3 - Custom spare field 3
Field4 - Custom spare field 4
Field5 - Custom spare field 5
Field6 - Custom spare field 6
Field7 - Custom spare field 7
Field8 - Custom spare field 8
Field9 - Custom spare field 9
Status - Current line status
Strategy - Single-character put-away strategy code
ICNQty - ICN quantity for this line
PlantCode - Plant code for the item
CheckerPutawayBy - Checker who verified put-away
CheckerPutawayDate - Put-away verification date
OriginalLineNumber - Line number before modification
SubLineNumber - Sub-line for split or partial lines
SpecialHandlingInstruc - Special handling instructions
Findings - Receiving inspection findings
HoldBy - User who placed item on hold
HoldDate - Date item was placed on hold
BlastedBy - User who performed blast freezing
BlastedDate - Blast freezing date
NCRRemarks - Non-conformance report remarks
BlastOnRF - Blast triggered via RF flag
AfterBlastBy - User who handled item after blasting
AfterBlastedDate - After-blast handling completion date
IsPartial - Partial receipt flag
isConfirmed - Line confirmed flag

Table: WMS.OutboundDetail (Also known as: dispatched items, outbound items, outbound line items, OCN details, OCN items)
DocNumber - Parent outbound document number
LineNumber - Line number in the document
PicklistNo - Picklist document number referencing parent OCN
ItemCode - Product identifier code
ColorCode - Color variant code
ClassCode - Classification code
SizeCode - Size variant code
BulkQty - Requested bulk quantity
BulkUnit - Bulk unit of measure
PicklistQty - Quantity assigned to picklist
Unit - Base unit of measure
BaseQty - Quantity in base units
StatusCode - String status code
BarcodeNo - Item or pallet barcode
Field1 - Batch Number
Field2 - Custom spare field 2
Field3 - Custom spare field 3
Field4 - Custom spare field 4
Field5 - Custom spare field 5
Field6 - Custom spare field 6
Field7 - Custom spare field 7
Field8 - Custom spare field 8
Field9 - Custom spare field 9
PickLineNumber - Picklist line number
Price - Unit price
Remarks - General line remarks
OCNLineNumber - OCN line number reference
OCNSubLineNumber - OCN sub-line number reference
PalletID - Source pallet identifier
Location - Source warehouse bin
RFCheckBy - RF user who verified the pick
RFCheckDate - RF verification date
ItemReturn - Item return flag or reference
Customer - Customer code for this line
LastEditedBy - User who last modified this line
LastEditedDate - Date of last modification
Lottable02 - Lot ID
ReturnBulkQty - Returned bulk quantity
ReturnBaseQty - Returned base quantity
Mkfgdate - Dispatched item manufacturing date
ExpiryDate - Dispatched item expiry date
WarehouseChecker - Checker who verified this line
Outlet - Receiving outlet or store
DropNo - Drop sequence number
DReport - Delivery report reference
SpecialHandling - Special handling instructions
Remarks1 - Additional remarks field 1
Remarks2 - Additional remarks field 2
RRDocdate - Receiving report date reference
OldQty - Quantity before modification
OldBulkQty - Bulk quantity before modification
OldPalletID - Pallet ID before reassignment
PickedPalletID - Actual pick pallet ID
IsNoChargeDetail - Free of charge line flag
PalletCount - Number of pallets for this line
BatchNumb - Dispatched item batch number
SONum - Sales order number
OutNotes - Outbound line notes
DRemarks - Delivery remarks
InboundDocNumber - Source inbound document number

Table Relationships (for JOINs):
- WMS.Inbound.DocNumber = WMS.InboundDetail.DocNumber
- WMS.Outbound.DocNumber = WMS.OutboundDetail.DocNumber
- WMS.Inbound.DocNumber = WMS.CountSheetSetup.RefTransDoc
- WMS.InboundDetail.ItemCode = WMS.OutboundDetail.ItemCode
- WMS.InboundDetail.PalletID = WMS.CountSheetSetup.PalletID

Output Format:

If valid question:
{
"query": "SQL query here"
}

If invalid question: (sample output)
{
    "message": "[(Be friendly) conversational reply here based on what the user asked]"
}
`,
           input: question
        });

        const responseText = response.output_text.trim();
        const responseJson = JSON.parse(responseText);
        return responseJson;

    } catch (err) {
         console.error("GenerateSQL Error:", err);

        return {
            success: false, 
            message: "I'm having trouble converting your question into a database query. Please try again or rephrase.", 
            error: err.message 
        };
    }
}

async function formatSQL(data, userQuestion) {
    try {
        const messageContent = `User question: ${userQuestion}\n\nData: ${
            typeof data === "string" ? data : JSON.stringify(data)
        }`;

        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: `
You are a data formatter for a Warehouse Management System.

Your ONLY job is to convert SQL query results into clear, natural English.

Rules:
- Use ONLY the data provided in the results
- Do NOT add information that is not in the results
- Do NOT make assumptions or estimates
- Do NOT explain what the data means beyond what's shown
- Keep responses short and concise — use one natural, conversational sentence only for queries that return exactly one column AND one row.
- Do NOT convert single-column multi-row results into a sentence; they must always be formatted as a table.
- Do NOT mention SQL, databases, or technical terms
- Output must be plain text only (NOT Markdown)

Output Format:

Single-value / simple result:
If the query returns exactly one column and one row ONLY, provide one sentence summarizing the data.

Multiple columns or multiple rows (even if only one row):
If the result contains more than one column OR more than one row, ALWAYS output a table.
The table must include the exact column names from the database as the header row.
Never include a sentence above or below the table.

Examples (correct table format):

DocDate            | AssignLoc
------------------ | ---------
2025-09-02         | 2AISLE

DocDate           
------------------ 
2025-09-02         
2026-11-05         

Invalid Format (DO NOT USE):

| DocDate            | AssignLoc |
| ------------------ | --------- |
| 2025-09-02         | 2AISLE    |

| DocDate            |
| ------------------ | 
| 2025-09-02         | 
| 2026-11-05         | 

STRICT RULES for table format:
- ALWAYS include the column header row first
- ALWAYS include a separator row after the header using dashes
- Include ONLY the first 5 rows of data, even if more rows exist
- Include ONLY the first 5 columns of data, even if more columns exist
- Use the actual column names from the data as headers
- Align columns using spaces
- Use " | " to separate columns
- The first character of the header line MUST NOT be "|".
- The last character of any line MUST NOT be "|".
- NEVER place "|" at the beginning of a line
- NEVER place "|" at the end of a line
- All date values must be output as YYYY-MM-DD; strip any time or timezone information.
- Do NOT convert the table to Markdown
- Do NOT add any sentence before or after the table
         `,
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: (messageContent)
                        }
                    ]
                }
            ]
        });
       return response.output_text;

    } catch (err) {
          console.error("FormatSQL Error:", err);

       return {
            success: false, 
            message: "Failed to format results. Please try again.",
            error: err.message 
        };
    }
}

async function generateTitle(question) {
    try {
        const response = await openai.responses.create({
            model: "gpt-4o-mini",
            instructions: `
Generate a chat title
Rules
- Max 4 words
- Based on user question
- No punctuation or quotes
- Return only the title
- Make it natural and readable
- Based on user intent
            `,
            input: question
        });

        return response.output_text.trim();

    } catch (err) {
          console.error("GenerateTitle Error:", err);

        return "New Conversation";
    }
}

//ADDED TWO FUNCTIONS FOR FORECASTING
async function detectIntent(question) {
    try {
        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
           instructions: `
You are an intent classifier for a Warehouse Management System chatbot.

Your ONLY job is to read the user's message and classify it into one of two intents:
- "forecast"
- "data"

HOW TO CLASSIFY:

Ask yourself one question: "Is the user trying to know about something that has NOT happened yet?"

- YES → "forecast"
- NO  → "data"

A "forecast" intent means the user wants the system to predict, project, or estimate future warehouse activity based on past patterns. The key signal is always a FUTURE TIME PERIOD or a request to ANALYZE TRENDS for the purpose of prediction.

A "data" intent means everything else — retrieving existing records, counting past transactions, asking conversational questions, greetings, follow-ups, or asking about what the system previously did.

STRICT OUTPUT RULES:
- Return ONLY a valid JSON object
- No explanations, no markdown, no extra text
- Never return anything outside of these two options:
  { "intent": "forecast" }
  { "intent": "data" }
- If genuinely unsure, default to { "intent": "data" }

Output format:
{ "intent": "data" }
`,
            input: question
        });

        const result = JSON.parse(response.output_text.trim());
        return result.intent;

    } catch (err) {
        return "data";
    }
}

async function generateForecast(question, historicalData) {

    try{
        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: `
            You are a warehouse data analyst for cold storage Warehouse Management System.

            Your job is to analyze historical warehouse data and generate a short, clear forecast.

            Rules:
            - Use ONLY the data provided to make predictions
            - Do NOT make up numbers that are not supported by the data
            - Identify  trends (increasing, decreasing, stable) from the data
            - Project forward based on those trends
            - Keep the forecast short, clear, and conversational
            - Plain text only,  no markdown
            - If the dat is insufficient to forecast, say so honestly

               `,
            input: `
            User request: ${question}
            Historical data:
            ${JSON.stringify(historicalData)}
            
            Based on this data, provide a forecast.
            `
        });

        return response.output_text.trim();

    } catch (err) {
        return "Unable to generate forecast. Try asking again.";
    }
}

async function runAi(question, conversation_id, conversation_title) {
    try {
        let convoId = conversation_id;

        if (convoId) {
            const existingTitle = await getConversationTitle(convoId);
            if (existingTitle) {
                conversation_title = existingTitle;
            }
        }

        if (!conversation_title) {
            conversation_title = await generateTitle(question);
        }

        if (!convoId) {
            convoId = await require("./chatDb.service").createConversation();
        }

        //session memory
        const conversationHistory = convoId ? await getChatById(convoId) : [];

        const historyContext = conversationHistory.length > 0
            ? conversationHistory.map(row =>
            `User: ${row.user_question}\nSQL: ${row.generated_sql || 'none'}\nAssistant: ${row.ai_response || ''}`
              ).join('\n\n')
            : null;

        const fullInput = historyContext
            ? `Previous conversation:\n${historyContext}\n\nCurrent question: ${question}`
            : question;

        // NEW: detect intent
        const intent = await detectIntent(fullInput);

        // NEW: forecast path
        if (intent === 'forecast') {
            const forecastSqlOutput = await generateSQL(fullInput);

            if (!forecastSqlOutput || !forecastSqlOutput.query) {
                return {
                    success: true,
                    sql: null,
                    title: conversation_title,
                    conversation_id: convoId,
                    data: forecastSqlOutput?.message || "I couldn't understand what data to forecast. Try being more specific.",
                    executionTimeMs: null
                };
            }
            
const forecastResults = await runQuery(forecastSqlOutput.query);

        if (!forecastResults.success){
            return {
                success: false,
                sql: forecastSqlOutput.query,
                title: conversation_title,
                conversation_id: convoId,
                data: "Could not fetch data for forecasting. Try again.",
                error: forecastResults.error,
                executionTimeMs: null
            };
        }

        const forecast = await generateForecast(question, forecastResults.data);

        return {
            success: true,
            sql: forecastSqlOutput.query,
            title: conversation_title,
            conversation_id: convoId,
            data: forecast,
            executionTimeMs: forecastResults.executionTimeMs
        };
        }

        // DEFAULT: data path — existing flow unchanged
const generatedSqlOutput = await generateSQL(fullInput);

        if (!generatedSqlOutput || !generatedSqlOutput.query) {
            return {
                success: false,
                sql: null,
                title: conversation_title,
                 data: generatedSqlOutput?.message || "Unable to generate SQL from your question.",
                error: "SQL generation failed",
                executionTimeMs: null
            };
        }

        const results = await runQuery(generatedSqlOutput.query);

        if (!results.success) {
            return {
                success: false,
                sql: generatedSqlOutput.query,
                title: conversation_title,
                data: "Cannot run the query. Try again.",
                error: "Database execution failed",
                executionTimeMs: null
            };
        }

        const limitedData = results.data.slice(0, 10);

        const cleanedData = limitedData.map(row => {
            const newRow = {};
            Object.keys(row).slice(0, 5).forEach(key => {
                newRow[key] = row[key];
            });
            return newRow;
        });

        const formatted = await formatSQL(cleanedData, question);

        return {
            sql: generatedSqlOutput.query,
            success: true,
            title: conversation_title,
            conversation_id: convoId,
            data: formatted,
            executionTimeMs: results.executionTimeMs
        };

    } catch (err) {
        return {
            success: false,
            sql: null,
            title: conversation_title || null,
            data: null,
            error: "Something went wrong. Please try again.",
            executionTimeMs: null
        };
    }
}

        //ADDED EXPORTS
module.exports = { 
    generateSQL, 
    generateTitle,
    formatSQL,
    generateForecast,
    detectIntent,
    runAi
};