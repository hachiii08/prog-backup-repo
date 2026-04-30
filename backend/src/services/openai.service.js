require('dotenv').config();
const OpenAI = require('openai');
const { runQuery } = require("../services/db.service");
const { getConversationTitle, getChatById } = require("../services/chatDb.service");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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

async function sessionMemory(convoId) {
    const conversationHistory = convoId ? await getChatById(convoId) : [];

    const historyContext = conversationHistory    //UPDATED
        .filter(row => row.execution_status !== 'error')
        .slice(-10)
        .map(row => 
            `User: ${row.user_question}\nSQL: ${row.generated_sql || 'none'}\nAssistant: ${row.ai_response || ''}`
        ).join('\n\n') || null;

    const today = new Date().toISOString().split('T')[0];
    const dateContext = `System context: The current date is ${today}. Use this only for relative date references like "today", "this month", or "this year". Do not filter by this date unless the user explicitly asks for today's data.`;

    return historyContext
        ? `${dateContext}\n\nPrevious conversation:\n${historyContext}\n\nCurrent question:`
        : `${dateContext}`;
}

async function generateSQL(question) {
    try {
        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: //ADDED intent rules and changed output format for forecast
`
You are a SQL assistant for a Warehouse Management System (WMS) used by a cold storage company.

Your job is to convert natural language questions into SQL SELECT queries.

IMPORTANT:
Before generating SQL, classify the question as either FORECAST or DATA.

FORECAST — user explicitly wants a PREDICTION or PROJECTION of FUTURE activity:
- Keywords: predict, forecast, project, estimate, expect, "what will", "how many will", "what do you think next month"
- Must reference a FUTURE time period AND request a prediction

DATA — everything else, including:
- Retrieving, listing, counting, or showing existing records
- Comparing two time periods ("compare January vs February")
- Asking about trends in past data ("was it higher last month?")
- Follow-up questions referencing previous results ("show me that", "give me the data")
- Any question with a specific past or present date range
- Questions using "compare", "versus", "vs", "difference between"
- User explicitly says "fetch data", "not a forecast", "just show me", "give me the data"

KEY RULE:
- A date alone does NOT make something a forecast
- "Show me inbound in February 2026" → DATA
- "Compare January vs February 2026" → DATA
- "Predict inbound for next month" → FORECAST
- When in doubt, default to DATA

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

FORECASTING QUERIES RULE

When the question involves forecasting, trends, or future estimation:

- DO NOT query future dates
- ALWAYS return historical data only (to be used for forecasting)

RULES:
- Fetch at least 3–6 months of historical data
//
- Do NOT use GETDATE() as the anchor for date ranges
- Instead fetch the most recent available data using ORDER BY DocDate DESC
- Use this pattern:
  SELECT TOP 6 YEAR(DocDate) AS Year, MONTH(DocDate) AS Month, COUNT(*) AS Total
  FROM WMS.Inbound
  GROUP BY YEAR(DocDate), MONTH(DocDate)
  ORDER BY YEAR(DocDate) DESC, MONTH(DocDate) DESC
//
- Always use aggregation (COUNT(*) or SUM())
- Always group by YEAR(DocDate), MONTH(DocDate)
- Always order by YEAR(DocDate), MONTH(DocDate)

OUTPUT REQUIREMENTS:
- Return ONLY monthly aggregated historical data
- DO NOT generate predictions or future values
- DO NOT include explanations or extra text

EXAMPLE:
SELECT TOP 6 YEAR(DocDate) AS Year, MONTH(DocDate) AS Month, COUNT(*) AS Total
FROM WMS.Outbound
GROUP BY YEAR(DocDate), MONTH(DocDate)
ORDER BY YEAR(DocDate) DESC, MONTH(DocDate) DESC

SQL GENERATION RULES:
- Only generate SELECT queries.
- Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, MERGE, EXEC.
- NEVER use UNION, UNION ALL, INTERSECT, or EXCEPT.
- Use SQL Server syntax only.
- Generate only ONE query (no multiple statements).
- ALWAYS use SELECT TOP 10 for listing queries (show, list, give me).
- ALWAYS use SELECT TOP 10 for any query that uses JOIN, applied once on the outermost query only.
- Do not use TOP and DISTINCT together.
- NEVER use SELECT * — always specify column names explicitly.
- Use only the provided schema.
- NEVER assume, invent, or shorten column names.
- Do not use undefined columns or tables.
- NEVER use a column named ID.
- If the query involves multiple tables, use JOIN based on defined relationships.
- If a required column is not in the main table, JOIN the correct related table.
- For broad queries (e.g., "all transactions"), default to WMS.Inbound.
- If the question is unrelated to warehouse operations, follow the invalid response format.

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

If valid forecast question (prediction, trend, future, next month/year/quarter):
{
  "intent": "forecast",
  "query": "SELECT TOP 6 YEAR(DocDate) AS Year, MONTH(DocDate) AS Month, COUNT(*) AS Total FROM ... GROUP BY ... ORDER BY ...",
  "forecastMonths": <number of months the user wants to forecast>,
  "forecastScope": "<specific month(s) or period the user wants forecasted e.g. March 2026, Q2 2026>"
}

If valid data question (listing, filtering, counting, retrieving):
{
  "intent": "data",
  "query": "SQL query here"
}

If invalid question:
{
  "intent": "data",
  "query": null,
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
- Do NOT mention SQL, databases, or technical terms
- Output must be plain text only — NOT Markdown, NOT Markdown tables

---

OUTPUT RULES — follow exactly:

CASE 1 — Exactly one column AND exactly one row:
Output a single sentence summarizing the value. No table.

CASE 2 — Everything else (more than one column, OR more than one row, OR both):
Output a plain text table. No sentence before or after the table. No exceptions.

---

PLAIN TEXT TABLE FORMAT — strict rules:

1. First line: column headers, separated by " | "
2. Second line: separator using dashes, one per column, separated by " | "
3. Following lines: data rows, one per line, separated by " | "
4. Include ONLY the first 5 rows of data
5. Include ONLY the first 5 columns of data
6. Use exact column names from the data as headers
7. Align columns using spaces
8. Strip all time and timezone from dates — output dates as YYYY-MM-DD only

ABSOLUTE FORMATTING RULES — no exceptions:
- The FIRST CHARACTER of every single line must NOT be "|"
- The LAST CHARACTER of every single line must NOT be "|"
- Every line starts with a column value or column name — never with "|"
- Every line ends with a column value or column name — never with "|"
- Do NOT output anything before the table (no title, no sentence, no label)
- Do NOT output anything after the table (no sentence, no note, no summary)
- Do NOT wrap the table in Markdown code fences or backticks
- If a cell value is NULL, empty, or blank, output the word NULL in that cell — never leave a cell empty or blank

---

CORRECT examples:

Example A — one column, one row → sentence only:
  There are 142 items in stock.

Example B — two columns, multiple rows → plain text table:
  DocDate            | AssignLoc
  ------------------ | ---------
  2025-09-02         | 2AISLE
  2025-11-05         | 3BRACK

Example C — one column, multiple rows → plain text table:
  DocDate
  ------------------
  2025-09-02
  2026-11-05

Example D — table with null/empty values → display NULL:
DocNumber   | DocDate    | AssignLoc
----------- | ---------- | ---------
ICN0001054  | 2026-01-03 | NULL
ICN0001055  | NULL       | 2AISLE
ICN0001056  | 2026-01-04 | NULL

---

WRONG — never output this format:
  | DocDate | AssignLoc |
  |---------|-----------|
  | 2025-09-02 | 2AISLE |
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
//changed forecast prompt
async function generateForecast(question, historicalData, forecastMonths, forecastScope) {
    try {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long' });
        const currentYear = today.getFullYear();

        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: `
You are a warehouse data analyst for a cold storage Warehouse Management System.

IMPORTANT: Today is ${currentMonth} ${currentYear}.
- All forecast periods must start from NEXT month after today
- Do NOT forecast months that have already passed
- Do NOT forecast the current month
- Example: if today is April 2026, forecast starts at May 2026

Your job is to analyze historical warehouse data and generate a short, clear forecast.

SCOPE RULES:
- The forecast scope MUST match exactly what the user asked for
- If the user asked about a specific customer, warehouse, item, or date. forecast that scope only
- Do NOT broaden the scope beyond what the user specified

DATA QUALITY RULES:
- Only use valid non-null data points for trend analysis
- If a data point is drastically lower or higher than surrounding months, flag it as an anomaly and exclude it from trend calculations
- If a month is missing from the dataset, treat the latest available valid data point as your baseline. Do not assume missing months exist and do not treat them as zero.

FORECASTING DECISION — follow this exactly based on how many valid non-null data points exist:

If 3 or more valid months of data:
- Forecast normally with specific number ranges based on the trend
- Confidence Level: High or Medium depending on consistency

If 1 or 2 valid months of data:
- Forecast a general trend direction only: increasing, decreasing, or stable
- Do NOT use exact numbers or percentages
- Begin Trend Summary with: "This forecast is based on limited data and should be treated as a rough estimate only."
- Confidence Level: Low

If zero valid data points:
- Skip the Forecast block entirely
- Replace it with one plain conversational sentence explaining what data was found and why a forecast cannot be made
- Suggest what the user should ask instead to get better results

INVENTORY TABLE RULE:
- If the historical data comes from an inventory or stock table rather than transaction records, explain that inventory forecasting is unreliable because it only reflects current stock levels, not historical trends. Suggest asking about inbound or outbound transaction trends instead.

FORMAT RULES:
- Plain text only. No markdown of any kind.
- No asterisks, bold, italics, bullet points, dashes, or markdown symbols
- No numbered lists
- Write in plain conversational paragraphs only

Output Format:
Follow this format EXACTLY. Do not add extra text or extra lines.

Forecast Period: <Month–Month Year>

Trend Summary: <1–2 sentences only>

Forecast:
<Month Year>: <number range or trend direction>
<Month Year>: <number range or trend direction>

Note: <If data was sufficient (3 or more valid months), write: "Forecast is based on [X] months of historical data." If data was limited (1 or 2 valid months), explain what data was actually used and suggest the user ask for a broader date range for a more accurate forecast.>

Confidence Level: <Low | Medium | High>
            `,
            input: `
User request: ${question}
Forecast period requested: ${forecastMonths} month(s) — ${forecastScope}
Historical data:
${JSON.stringify(historicalData)}

Based on this data, provide a forecast for EXACTLY ${forecastMonths} month(s): ${forecastScope}. Do not forecast any additional periods.
            `
        });

        return response.output_text.trim();

    } catch (err) {
        console.error("Generate Forecast Error:", err);
        return "Unable to generate a forecast at this time. Please try again.";
    }
}

async function runAi(question, conversation_id, conversation_title) {
    try {
        let convoId = conversation_id;
        // get existing title
        if (convoId) {
            const existingTitle = await getConversationTitle(convoId);
            if (existingTitle) {
                conversation_title = existingTitle;
            }
        }
        // generate title if none
        if (!conversation_title) {
            conversation_title = await generateTitle(question);
        }
        // create conversation if none
        if (!convoId) {
            convoId = await require("./chatDb.service").createConversation();
        }
        // session memory
        const memory = await sessionMemory(convoId);
        const fullInput = `${memory} ${question}`;
        
        // generate SQL + intent
        const sqlOutput = await generateSQL(fullInput);
        const intent = sqlOutput.intent; // ← added
        if (!sqlOutput || !sqlOutput.query) {
            return {
                success: true,
                sql: null,
                title: conversation_title,
                conversation_id: convoId,
                data: sqlOutput?.message || "Unable to generate SQL from your question.",
                error: "SQL generation failed",
                executionTimeMs: null
            };
        }

        // get data in db
        const results = await runQuery(sqlOutput.query);
        if (!results.success) {
            return {
                success: false,
                sql: sqlOutput.query,
                title: conversation_title,
                conversation_id: convoId,
                data: "I couldn’t retrieve the data. Please try again or rephrase your question.",
                error: results.error || "Query execution failed",
                executionTimeMs: null
            };
        }
        // branching
        if (intent === 'forecast') {
            // Forecast path
            const forecast = await generateForecast(fullInput, results.data, sqlOutput.forecastMonths, sqlOutput.forecastScope);//updated to match new params
            return {
                success: true,
                sql: sqlOutput.query,
                title: conversation_title,
                conversation_id: convoId,
                data: forecast,
                executionTimeMs: results.executionTimeMs
            };
        } else {
            // data path
            const limitedData = results.data.slice(0, 10);
            const cleanedData = limitedData.map(row => {
                const newRow = {};
                Object.keys(row).slice(0, 5).forEach(key => {
                    newRow[key] = row[key];
                });
                return newRow;
            });
            const formatted = await formatSQL(cleanedData, fullInput);
            return {
                success: true,
                sql: sqlOutput.query,
                title: conversation_title,
                conversation_id: convoId,
                data: formatted,
                executionTimeMs: results.executionTimeMs
            };
        }
    } catch (err) {
        return {
            success: false,
            sql: null,
            title: conversation_title || null,
            data: "Something went wrong. Please try again.",
            error: err?.message || err,
            executionTimeMs: null
        };
    }
}

module.exports = { 
    generateTitle,
    generateSQL, 
    formatSQL,
    generateForecast,
    runAi
};