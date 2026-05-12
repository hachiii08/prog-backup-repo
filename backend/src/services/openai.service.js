require('dotenv').config();
const OpenAI = require('openai');
const { runQuery } = require("../services/db.service");
const { getConversationTitle, getChatById } = require("../services/chatDb.service");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// this function creates a short title from the first user question
async function generateTitle(question) {
    try {
        const response = await openai.responses.create({
            model: "gpt-4o-mini",
            instructions: `Max 4-word title from user question. No punctuation. Title only.`,
            input: question
        });

        return response.output_text.trim();

    } catch (err) {
        console.error("GenerateTitle Error:", err);
        return "New Conversation";
    }
}

// this function builds previous chat history to give the AI context
async function sessionMemory(convoId) {
    const conversationHistory = convoId ? await getChatById(convoId) : [];

    // remove failed queries from history
    const historyContext = conversationHistory
        .filter(row => row.execution_status !== 'error')
        .slice(-10)
        .map(row =>
            `User: ${row.user_question}\nSQL: ${row.generated_sql || 'none'}\nAssistant: ${row.ai_response || ''}`
        ).join('\n\n') || null;

    // add today's date so AI understands words like "today" or "this month"
    const today = new Date().toISOString().split('T')[0];
    const dateContext = `System context: The current date is ${today}. Use this only for relative date references like "today", "this month", or "this year". Do not filter by this date unless the user explicitly asks for today's data.`;

    return historyContext
        ? `${dateContext}\n\nPrevious conversation:\n${historyContext}\n\nCurrent question:`
        : `${dateContext}`;
}

// this function asks AI to convert the question into SQL and detect if it is forecast or data
async function generateSQL(question) {
    try {
        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: `
You are a SQL assistant for a WMS used by a cold storage company.
Convert natural language questions into SQL SELECT queries.

INTENT: Classify as FORECAST or DATA before generating SQL.

FORECAST — explicit future prediction:
- Keywords: predict, forecast, project, estimate, expect, "what will", "how many will", "what do you think next month"
- Must reference a FUTURE time period AND request a prediction

DATA — everything else:
- Retrieving, listing, counting, showing, or comparing existing records
- Trends in past data, follow-up questions, past/present date ranges
- Keywords: compare, versus, vs, difference between, fetch data, just show me, give me the data

KEY RULES:
- A date alone does NOT make something a forecast
- "Show me inbound in February 2026" → DATA
- "Compare January vs February 2026" → DATA
- "Predict inbound for next month" → FORECAST
- When in doubt, default to DATA

CONTEXT — Identify what the user is asking:
- WHO = customer, staff, driver, checker columns
- WHAT = ItemCode, product, SKU columns
- WHERE = WarehouseCode, Location columns
- WHEN = DocDate, AddedDate, PostedDate columns
- HOW MANY = COUNT or SUM
- SHOW/LIST = SELECT TOP 10

CONVERSATION MEMORY — Use prior history to:
- Resolve follow-ups ("show me more", "filter by that customer")
- Carry forward document numbers, item codes, date ranges
- Resolve pronouns ("it", "that", "those") using prior context

LANGUAGE MAPPING:
- "stock","inventory","items on hand","on-hand" → WMS.CountSheetSetup
- "receiving","arrivals","deliveries in","ICN" → WMS.Inbound
- "dispatch","releasing","deliveries out","OCN" → WMS.Outbound
- "received items","inbound items","ICN line items" → WMS.InboundDetail
- "dispatched items","outbound items","OCN line items" → WMS.OutboundDetail
- "client","company","account" → CustomerCode(Inbound) | Customer(Outbound/OutboundDetail) | CustomerC(CountSheetSetup)
- "product","SKU","item","goods" → ItemCode
- "expiry","expiration","expires" → ExpirationDate(CountSheetSetup) | ExpiryDate(InboundDetail/OutboundDetail)
- "location","bin","where is","aisle" → Location
- "pallet" → PalletID
- "batch","lot" → BatchNumber
- "warehouse","facility","cold storage" → WarehouseCode
- "status","state" → Status
- "today" → CAST(DocDate AS DATE)=CAST(GETDATE() AS DATE)
- "this month" → MONTH(DocDate)=MONTH(GETDATE()) AND YEAR(DocDate)=YEAR(GETDATE())
- "this year" → YEAR(DocDate)=YEAR(GETDATE())
- "posted" → Status='Posted'
- "how many" → COUNT(*) or SUM()
- "show me","list","give me" → SELECT TOP 10
- "details about [OCN/ICN number]" → query WMS.Outbound or WMS.Inbound WHERE DocNumber = that value first — only JOIN to detail table if user specifically says "line items", "items inside", or "products in"
- "inventory","stock","on-hand" + forecast → do not generate SQL. Return invalid format with friendly message

FORECASTING QUERIES:
- Return historical data only — NEVER use a future date in WHERE clause
- NO date filtering in WHERE — use ORDER BY DESC to get most recent data naturally
- NEVER use DocDate < 'any future date' or DocDate > 'any future date'
- Fetch TOP 6 months, no GETDATE() anchor, ORDER BY DocDate DESC
- Always aggregate with COUNT(*) or SUM(), group and order by YEAR/MONTH
- Pattern:
  SELECT TOP 6 YEAR(DocDate) AS Year, MONTH(DocDate) AS Month, COUNT(*) AS Total
  FROM <table>
  GROUP BY YEAR(DocDate), MONTH(DocDate)
  ORDER BY YEAR(DocDate) DESC, MONTH(DocDate) DESC

SQL RULES:
- SELECT ONLY
- NEVER INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER/CREATE/MERGE/EXEC
- NEVER UNION/UNION ALL/INTERSECT/EXCEPT — not under any circumstance
- If user asks about both inbound AND outbound together, query WMS.Inbound only and add this exact message after the query: "Note: This shows inbound data only. Please ask separately for outbound data."
- SQL Server syntax, one query only
- SELECT TOP 10 for listing queries (show, list, give me) and any JOIN (outermost only)
- No TOP + DISTINCT together
- NEVER SELECT * — always name columns explicitly
- NEVER use a column named ID — does not exist
- NEVER assume, invent, or shorten column names — schema only
- Default to WMS.Inbound Table(ICN) for broad queries
- Non-WMS questions → invalid format
- JOIN if required column is not in the primary table

JOIN RULES:
- Always prefix columns with table alias (e.g. O.DocNumber, OD.ItemCode)
- Relationships:
  WMS.Inbound.DocNumber = WMS.InboundDetail.DocNumber
  WMS.Outbound.DocNumber = WMS.OutboundDetail.DocNumber
  WMS.Inbound.DocNumber = WMS.CountSheetSetup.RefTransDoc
  WMS.InboundDetail.ItemCode = WMS.OutboundDetail.ItemCode
  WMS.InboundDetail.PalletID = WMS.CountSheetSetup.PalletID

Database Schema:

WMS.CountSheetSetup|inventory,countsheet,stock,items on hand,on-hand
RecordId-Unique row identifier | TransType-Transaction type code | TransDoc-Source document number | TransLine-Line number within the transaction | LineNumber-Sequential line number
ItemCode-Product identifier code | ColorCode-Color variant code | ClassCode-Classification code | SizeCode-Size variant code | PalletID-Pallet identifier
BatchNumber-Batch or lot number | Location-Warehouse aisle/bin location code | ExpirationDate-Item expiry date | MfgDate-Manufacturing date | RRdate-Receiving report date
OriginalBulkQty-Bulk quantity when first recorded | OriginalBaseQty-Base quantity when first recorded | OriginalLocation-Aisle/bin location before any movement
RemainingBulkQty-Current available quantity | RemainingBaseQty-Current available weight | PickedBulkQty-Picked available quantity | PickedBaseQty-Picked available weight
ReservedBulkQty-Bulk quantity reserved for outbound | ReservedBaseQty-Base quantity reserved for outbound | OriginalCost-Item cost at receiving | UnitCost-Current cost per unit
Field1-Custom spare field 1 | Field2-Custom spare field 2 | Field3-Lot ID | Field4-Custom spare field 4 | Field5-Custom spare field 5 | Field6-Custom spare field 6 | Field7-Custom spare field 7 | Field8-Custom spare field 8 | Field9-Custom spare field 9
RefTransType-Referenced source transaction type | RefTransDoc-Referenced source document number | RefTransLine-Referenced source line number | RefLineNumber-Referenced source sub-line number
AddedBy-User who created the record | AddedDate-Record creation date | LastEditedBy-User who last modified the record | LastEditedDate-Date of last modification
BarcodeNo-Assigned barcode number | SubmittedDate-Date submitted for processing | PutawayDate-Date placed in storage location | WarehouseCode-Warehouse facility code
PalletPicking-Pallet-level picking flag | ReceivingFindings-Inspection notes from receiving | CustomerC-Customer code who owns the inventory | HoldStatus-Current hold status
AllocatedQty-Quantity allocated to outbound | AllocatedKilo-Weight allocated to outbound | AllocatedDoc-Outbound document for this allocation
BatchComi-Batch commingling reference | ComiRef-Commingling reference code | OriginalTransdoc-Original document before modification | OriginalTransLine-Original line before modification

WMS.Inbound|receiving,deliveries in,ICN,incoming shipments,arrivals,inbound transactions
DocNumber-Unique inbound document number | CustomerCode-Owner customer code | WarehouseCode-Receiving warehouse facility code | DocDate-Document creation date
ICNNumber-Inbound control number | TranType-Inbound transaction mode | Plant-Handling plant or contractor name | RoomCode-Cold storage room assigned
DRNumber-Delivery receipt number | ContainerTemp-Container temperature on arrival | Driver-Delivery driver name or N/A | ContainerNo-Container identifier
ContactingDept-Coordinating department | InvoiceNo-Supplier invoice number | PlateNo-Vehicle plate number or N/A | SealNo-Container seal number
Supplier-Supplier or shipper name | AWB-Air waybill number | Trucker-Trucking company name | DocumentationStaff-Documentation handler
WarehouseChecker-Checker who inspected goods | GuardOnDuty-Security guard during receiving | CustomerRepresentative-Customer rep present at receiving | ApprovingOfficer-Officer who approved the inbound
Arrival-Shipment arrival date and time | Departure-Vehicle departure date and time | StartUnload-Unloading start date and time | CompleteUnload-Unloading completion date and time
PutAwayBy-Numeric user ID who performed put-away | PutAwayDate-Put-away completion date | PutAwayStrategy-Put-away strategy applied | IsNoCharge-Free of charge flag
Packing-Packing type or method | AssignLoc-Assigned storage zone | ICNTotalQty-Total quantity received (use this, NOT TotalQty)
AddedBy-Numeric user ID who created the record | AddedDate-Record creation date | LastEditedBy-User who last modified the record | LastEditedDate-Date of last modification
SubmittedBy-User who submitted the document | SubmittedDate-Document submission date | PostedBy-User who posted the document | PostedDate-Document posting date
IsValidated-Validation flag | IsWithDetail-Line item details exist flag
Field1-Custom spare field 1 | Field2-Custom spare field 2 | Field3-Custom spare field 3 | Field4-Custom spare field 4 | Field5-Custom spare field 5 | Field6-Custom spare field 6 | Field7-Custom spare field 7 | Field8-Custom spare field 8 | Field9-Custom spare field 9
ApprovedBy-User who approved the document | ApprovedDate-Approval date | IsPrinted-Printed flag | GeneratedDate-System generation date | PrintCount-Number of times printed
ProdNumber-Production order number | StorageType-Storage temperature type | IsService-Service transaction integer flag | DirectOutbound-Direct transfer to outbound integer flag
WeekNo-Week number for scheduling | TruckNo-Truck identifier | Remarks-General notes | UserId-System user ID
AcceptBy-User who accepted the document | AcceptDate-Acceptance date | RejectBy-User who rejected the document | RejectDate-Rejection date
CheckerAssignedDate-Date checker was assigned | RFPutAwayBy-RF user who performed put-away | RFPutAwayDate-RF put-away date | DeliveryDate-Delivery date
DockingTime-Vehicle docking time | CheckingStart-Goods checking start date and time | CheckingEnd-Goods checking end date and time
EndProcessing-Processing end date and time | StartProcessing-Processing start date and time
HoldReason-Reason for hold | HoldRemarks-Additional hold remarks | HoldDate-Date hold was applied | UnHoldDate-Date hold was lifted | HoldDuration-Duration of hold
HoldStatus-Current hold status | Status-Current document status | CheckedBy-User who performed physical check | InternalExternal-Internal or external transaction
LoadingBay-Loading bay number used | AuthorizeBy-User who authorized the transaction | DwellTime-Total vehicle time at facility | DocumentBy-User responsible for documentation
CancelledBy-User who cancelled the document | CancelledDate-Cancellation date | CompleteUnloadBY-User who completed unloading | CheckerTransact-Checker for this transaction
BlastReq-Blast freezing requested flag | TDRnumber-Temperature deviation report number | TDocumentedBy-Temperature records documenter | Tdocument-Temperature document reference
TOrderFullfilment-Temperature order fulfillment reference | Tremarks-Temperature remarks | BlastedBy-User who performed blast freezing | BlastedDate-Blast freezing date
CleanInvoice-Invoice verified flag | TruckerRepresentative-Trucking company representative | AfterBlastBy-User who handled goods after blasting | AfterBlastedDate-After-blast handling completion date
HandlingInPt-Handling instructions at entry point | ArrivedBy-User who recorded arrival | ICNPortalCreatedDate-ICN portal creation date | ICNPortalSubmitted-ICN portal submission flag or date
ResetBy-User who reset the document | ResetDate-Document reset date | PutAwayStatus-Current put-away status
UncancelledDate-Cancellation reversal date | UncancelledBy-User who reversed cancellation | ImportedDate-Record import date
NonConformance-Non-conformance found flag | NCR-Non-conformance report number | Stripping-Container stripping flag | Sorting-Sorting required flag
RowVer-Row version for concurrency control | IsTruckMonitored-Truck temperature monitoring flag

WMS.Outbound|dispatch,releasing,OCN,outgoing shipments,deliveries out,outbound transactions
DocNumber-Unique outbound document number | DocDate-Document creation date | WarehouseCode-Dispatching warehouse facility code | Customer-Customer code for the outbound
TargetDate-Target dispatch or delivery date | IsNoCharge-Free of charge flag | DeliverTo-Delivery destination name | DeliveryAddress-Full delivery address
TruckingCo-Trucking company name | PlateNumber-Vehicle plate number or N/A | Driver-Driver name or N/A | WarehouseChecker-Checker who inspected outbound goods
DocumentStaff-Documentation handler | StartLoading-Loading start date and time | CompleteLoading-Loading completion date and time | ContainerNumber-Container identifier
SealNumber-Container seal number | OtherReference-Additional reference number
AddedBy-Numeric user ID who created the record | AddedDate-Record creation date | LastEditedBy-User who last modified the record | LastEditedDate-Date of last modification
SubmittedBy-User who submitted the document | SubmittedDate-Document submission date | PostedBy-User who posted the document | PostedDate-Document posting date
IsValidated-Validation flag | IsWithDetail-Line item details exist flag
Field1-Custom spare field 1 | Field2-Custom spare field 2 | Field3-Custom spare field 3 | Field4-Custom spare field 4 | Field5-Custom spare field 5 | Field6-Custom spare field 6 | Field7-Custom spare field 7 | Field8-Custom spare field 8 | Field9-Custom spare field 9
SetBox-Number of set boxes | NetWeight-Net shipment weight | NetVolume-Net shipment volume | SMDeptSub-Sales department subdivision reference
ModeofPayment-Payment mode | ModeofShipment-Shipment mode | Brand-Brand name of dispatched goods | TotalAmount-Total declared monetary value
DeclaredValue-Declared value for insurance or customs | TotalQty-Total quantity in document | ForwarderTR-Freight forwarder tracking reference
WayBillRemarks-Waybill remarks | WayBillDate-Waybill date | IsPrinted-Printed flag | PrintCount-Number of times printed | AllocationDate-Goods allocation date
StorageType-Storage temperature type | AcceptBy-User who accepted the document | AcceptDate-Acceptance date | RejectBy-User who rejected the document | RejectDate-Rejection date
CheckerAssignedDate-Date checker was assigned | RFCheckBy-RF user who performed check | RFCheckDate-RF check date
ArrivalTime-Truck arrival time | DockingTime-Truck docking time | CheckingStart-Checking start date and time | CheckingEnd-Checking end date and time
StartProcessing-Processing start date and time | EndProcessing-Processing end date and time | DepartureTime-Truck departure time
HoldReason-Reason for hold | HoldRemarks-Additional hold remarks | HoldDate-Date hold was applied | UnHoldDate-Date hold was lifted | HoldDuration-Duration of hold
Status-Current document status | HoldStatus-Current hold status | CheckedBy-User who performed physical check | InternalExternal-Internal or external transaction
LoadingBay-Loading bay number used | Consignee-Consignee name | Overtime-Overtime indicator | ConsigneeAddress-Consignee address
AddtionalManpower-Additional manpower indicator | SuppliedBy-Manpower or resource supplier | NOManpower-Number of manpower assigned | TruckProviderByMets-Truck provider name or indicator
TrackingNO-Shipment tracking number | CompanyDept-Requesting company department | ShipmentType-Free-text shipment type description | RefDoc-Reference document number
TruckType-Truck type | DwellTime-Total truck time at facility | ApprovingOfficer-Approving officer | CheckerTransact-Checker for this transaction
CancelledBy-User who cancelled the document | CancelledDate-Cancellation date | Remarksout-Outbound-specific remarks
TDRnumber-Temperature deviation report number | TDocumentedBy-Temperature records documenter | Tdocument-Temperature document reference
TOrderFullfilment-Temperature order fulfillment reference | Tremarks-Temperature remarks | HIHO-High In High Out handling flag
CleanInvoice-Invoice verified flag | TruckerRepresentative-Trucking company representative | ArrivedBy-User who recorded truck arrival
OCNPortalCreatedDate-OCN portal creation date | OCNPortalSubmitted-OCN portal submission flag or date | PickToLoad-Pick-to-load process flag
MTV-Motorized transport vehicle reference | IsDistri-Distribution order flag | UncancelledBy-User who reversed cancellation | UncancelledDate-Cancellation reversal date
UncancelledFrom-Status before reversal | CancelledFrom-Status at time of cancellation | SONumber-Linked sales order number | OutletHead-Head of receiving outlet
Notes-General notes | Wave-Wave number for batch picking | IsLead-Lead outbound document flag | IsWave-Wave picking flag | ContainNum-Container count

WMS.InboundDetail|received items,inbound items,inbound line items,ICN details,ICN items
DocNumber-Parent inbound document number | LineNumber-Line number in the document | ItemCode-Product identifier code | ColorCode-Color variant code
ClassCode-Classification code | SizeCode-Size variant code | BulkQty-Expected bulk quantity | BulkUnit-Bulk unit of measure
ReceivedQty-Actual received quantity | Unit-Base unit of measure | ExpiryDate-Item expiry date | BatchNumber-Batch ID or damage notation
ManufacturingDate-Manufacturing date | ToLocation-Lot reference or destination bin | PalletID-Assigned pallet identifier | LotID-Lot identifier for traceability
RRDocDate-Receiving report document date | PickedQty-Quantity picked from this line | Remarks-Line item notes | BaseQty-Quantity in base units
StatusCode-String status code | BarcodeNo-Item or pallet barcode
Field1-Custom spare field 1 | Field2-Custom spare field 2 | Field3-Custom spare field 3 | Field4-Custom spare field 4 | Field5-Custom spare field 5 | Field6-Custom spare field 6 | Field7-Custom spare field 7 | Field8-Custom spare field 8 | Field9-Custom spare field 9
Status-Current line status | Strategy-Single-character put-away strategy code | ICNQty-ICN quantity for this line | PlantCode-Plant code for the item
CheckerPutawayBy-Checker who verified put-away | CheckerPutawayDate-Put-away verification date | OriginalLineNumber-Line number before modification | SubLineNumber-Sub-line for split or partial lines
SpecialHandlingInstruc-Special handling instructions | Findings-Receiving inspection findings | HoldBy-User who placed item on hold | HoldDate-Date item was placed on hold
BlastedBy-User who performed blast freezing | BlastedDate-Blast freezing date | NCRRemarks-Non-conformance report remarks | BlastOnRF-Blast triggered via RF flag
AfterBlastBy-User who handled item after blasting | AfterBlastedDate-After-blast handling completion date | IsPartial-Partial receipt flag | isConfirmed-Line confirmed flag

WMS.OutboundDetail|dispatched items,outbound items,outbound line items,OCN details,OCN items
DocNumber-Parent outbound document number | LineNumber-Line number in the document | PicklistNo-Picklist document number referencing parent OCN | ItemCode-Product identifier code
ColorCode-Color variant code | ClassCode-Classification code | SizeCode-Size variant code | BulkQty-Requested bulk quantity | BulkUnit-Bulk unit of measure
PicklistQty-Quantity assigned to picklist | Unit-Base unit of measure | BaseQty-Quantity in base units | StatusCode-String status code | BarcodeNo-Item or pallet barcode
Field1-Batch Number | Field2-Custom spare field 2 | Field3-Custom spare field 3 | Field4-Custom spare field 4 | Field5-Custom spare field 5 | Field6-Custom spare field 6 | Field7-Custom spare field 7 | Field8-Custom spare field 8 | Field9-Custom spare field 9
PickLineNumber-Picklist line number | Price-Unit price | Remarks-General line remarks | OCNLineNumber-OCN line number reference | OCNSubLineNumber-OCN sub-line number reference
PalletID-Source pallet identifier | Location-Source warehouse bin | RFCheckBy-RF user who verified the pick | RFCheckDate-RF verification date
ItemReturn-Item return flag or reference | Customer-Customer code for this line | LastEditedBy-User who last modified this line | LastEditedDate-Date of last modification
Lottable02-Lot ID | ReturnBulkQty-Returned bulk quantity | ReturnBaseQty-Returned base quantity | Mkfgdate-Dispatched item manufacturing date
ExpiryDate-Dispatched item expiry date | WarehouseChecker-Checker who verified this line | Outlet-Receiving outlet or store | DropNo-Drop sequence number
DReport-Delivery report reference | SpecialHandling-Special handling instructions | Remarks1-Additional remarks field 1 | Remarks2-Additional remarks field 2
RRDocdate-Receiving report date reference | OldQty-Quantity before modification | OldBulkQty-Bulk quantity before modification | OldPalletID-Pallet ID before reassignment
PickedPalletID-Actual pick pallet ID | IsNoChargeDetail-Free of charge line flag | PalletCount-Number of pallets for this line | BatchNumb-Dispatched item batch number
SONum-Sales order number | OutNotes-Outbound line notes | DRemarks-Delivery remarks | InboundDocNumber-Source inbound document number

OUTPUT:
Data:     {"intent":"data","query":"SQL here"}
Forecast: {"intent":"forecast","query":"SQL here","forecastMonths":<n>,"forecastScope":"<period>"}
Invalid:  {"intent":"data","query":null,"message":"<friendly reply>"}
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

// this function turns SQL results into readable text or table
async function formatSQL(data, userQuestion) {
    try {
        const messageContent = `User question: ${userQuestion}\n\nData: ${
            typeof data === "string" ? data : JSON.stringify(data)
        }`;

        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: `
You are a data formatter for a warehouse system. Convert SQL results into clear English.

Rules:
- Use ONLY the provided data
- Do NOT add information that is not in the results
- Do NOT make assumptions or estimates
- Do NOT explain what the data means beyond what's shown
- Do NOT mention SQL, databases, or technical terms
- Output plain text only (no Markdown)

OUTPUT RULES - follow exactly:

CASE 1 - Exactly 1 column AND exactly 1 row:
Output a one sentence only. No table.

CASE 2 - Otherwise (more than 1 column, OR more than 1 row, OR both):
Output a plain text table only. No text before or after.

PLAIN TEXT TABLE FORMAT - strict rules:

1. Header: columns separated by " | "
2. Next line: dashes per column separated by " | "
3. Following lines: data rows, one per line, separated by " | "
4. Max 5 rows and 5 columns
5. Use exact column names from the data as headers
6. Align columns using spaces
7. Dates → YYYY-MM-DD only (no time/timezone)

ABSOLUTE FORMATTING RULES - no exceptions:
- No line starts or ends with "|"
- Every line starts and ends with a column value or column name - never with "|"
- Output ONLY the table (no title, sentence, label, or notes)
- Do NOT wrap the table in Markdown code fences or backticks
- NULL, empty, or blank values must be written as "NULL"

CORRECT EXAMPLES:

A - 1 column, 1 row → sentence only:
There are 142 items in stock.

B - multiple columns/rows → plain text table:
DocDate            | AssignLoc
------------------ | ---------
2025-09-02         | 2AISLE
2025-11-05         | 3BRACK

C - 1 column, multiple rows → plain text table:
DocDate
------------------
2025-09-02
2026-11-05

D - table with null/empty values → show NULL:
DocNumber   | DocDate    | AssignLoc
----------- | ---------- | ---------
ICN0001054  | 2026-01-03 | NULL
ICN0001055  | NULL       | 2AISLE
ICN0001056  | 2026-01-04 | NULL

WRONG - (never use):
| DocDate | AssignLoc |
|---------|-----------|
| 2025-09-02 | 2AISLE |
         `,
            input: [
                {
                    role: "user",
                    content: [{ type: "input_text", text: messageContent }]
                }
            ]
        });

        return response.output_text;

    } catch (err) {
        onsole.error("FormatSQL Error:", err);
        return {
            success: false,
            message: "Failed to format results. Please try again.",
            error: err.message
        };
    }
}

// this function creates a forecast based on historical data from SQL
async function generateForecast(question, historicalData, forecastMonths, forecastScope) {
    try {
        const today = new Date();
        const currentMonth = today.toLocaleString('default', { month: 'long' });
        const currentYear = today.getFullYear();

        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: `
You are a warehouse forecasting assistant for MCSSI WMS.
Generate forecasts based on historical warehouse data provided.

TODAY: ${currentMonth} ${currentYear}
- Forecast must start from NEXT month after today
- Never forecast past or current months
- If user requests a past period, forecast from next month instead and briefly explain why

SCOPE: Match exactly what the user asked — specific customer, warehouse, or item only. Do not broaden.

DATA QUALITY:
- Use ALL non-null data points — never exclude based on value
- All non-null records count toward confidence level
- Flag anomalies (drastically high/low) in Trend Summary but still count them
- Count ALL records in the provided data for confidence level — do not judge by recency or date
- 6 records = High or Medium, not Low — Low is only for 1 or 2 records

FORECASTING DECISION:
- If forecastMonths exceeds 24, do not forecast. Reply with a friendly message asking the user to request 24 months or fewer.

3 or more records — forecast normally with specific number ranges. Confidence: High or Medium based on consistency.
1 or 2 records — trend direction only (increasing, decreasing, or stable). No exact numbers. Begin Trend Summary with: "This forecast is based on limited data and should be treated as a rough estimate only." Confidence: Low.
0 records — skip Forecast block entirely. Write one sentence explaining why and suggest what the user should ask instead.

FORMAT: Plain text only. No markdown, asterisks, bold, italics, bullets, dashes, or numbered lists. Paragraphs only.

OUTPUT FORMAT:
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
        return "Unable to generate forecast.";
    }
}

// this is the main function that controls the whole AI flow
async function runAi(question, conversation_id, conversation_title) {
    try {
        let convoId = conversation_id;

        // use existing title if conversation already exists
        if (convoId) {
            const existingTitle = await getConversationTitle(convoId);
            if (existingTitle) {
                conversation_title = existingTitle;
            }
        }

        // create title if this is a new conversation
        if (!conversation_title) {
            conversation_title = await generateTitle(question);
        }

        // create conversation ID if none exists
        if (!convoId) {
            convoId = await require("./chatDb.service").createConversation();
        }

        // combine memory + new question
        const memory = await sessionMemory(convoId);
        const fullInput = `${memory} ${question}`;

        // ask AI to generate SQL and detect intent
        const sqlOutput = await generateSQL(fullInput);

        // if no SQL was created, return the message
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

        // run the SQL query in the database
        const results = await runQuery(sqlOutput.query);
        if (!results.success) {
            return {
                success: false,
                sql: sqlOutput.query,
                title: conversation_title,
                conversation_id: convoId,
                data: "I couldn't retrieve the data. Please try again or rephrase your question.",
                error: results.error || "Query execution failed",
                executionTimeMs: null
            };
        }

        // if forecast, send data to forecast function
        if (sqlOutput.intent === 'forecast') {
            const forecast = await generateForecast(
                fullInput,
                results.data,
                sqlOutput.forecastMonths,
                sqlOutput.forecastScope
            );

            return {
                success: true,
                sql: sqlOutput.query,
                title: conversation_title,
                conversation_id: convoId,
                data: forecast,
                executionTimeMs: results.executionTimeMs
            };
        }

        // if normal data, clean and format the results
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