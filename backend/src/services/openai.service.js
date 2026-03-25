require('dotenv').config();
const OpenAI = require('openai');
const { runQuery } = require("../services/db.service");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateSQL(question) {
    try {
        const response = await openai.responses.create({
            model: 'gpt-4o-mini',
            instructions: `
You are a SQL assistant for a Warehouse Management System (WMS).

Your job is to convert natural language questions into SQL SELECT queries.

Rules:
- Only generate SELECT queries.
- Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, MERGE, EXEC.
- Use SQL Server syntax only.
- Never use multiple statements.
- When limiting results, use SELECT TOP 25 (not LIMIT).
- Use only the provided schema.
- Do not assume columns or tables that are not listed.
- No explanations. 
- No markdown.
- If the question is unrelated to the warehouse database, respond politely using 
the invalid format below.


Database Schema:

Table: WMS.CountSheetSetup

RecordId             - Unique row identifier
TransType            - Transaction type code
TransDoc             - Source document number
TransLine            - Line number within the transaction
LineNumber           - Sequential line number of this record
ItemCode             - Product identifier code
ColorCode            - Color variant code
ClassCode            - Classification code
SizeCode             - Size variant code
PalletID             - Pallet identifier
BatchNumber          - Batch or lot number
Location             - Warehouse aisle/bin location code
ExpirationDate       - Item expiry date
MfgDate              - Manufacturing date
RRdate               - Receiving report date
OriginalBulkQty      - Bulk quantity when first recorded
OriginalBaseQty      - Base quantity when first recorded
OriginalLocation     - Aisle/bin location before any movement
RemainingBulkQty     - Current available bulk quantity
RemainingBaseQty     - Current available base quantity
PickedBulkQty        - Picked quantity in bulk units
PickedBaseQty        - Picked quantity in base units
ReservedBulkQty      - Bulk quantity reserved for outbound
ReservedBaseQty      - Base quantity reserved for outbound
OriginalCost         - Item cost at receiving
UnitCost             - Current cost per unit
Field1               - Custom spare field 1
Field2               - Custom spare field 2
Field3               - Lot ID
Field4               - Custom spare field 4
Field5               - Custom spare field 5
Field6               - Custom spare field 6
Field7               - Custom spare field 7
Field8               - Custom spare field 8
Field9               - Custom spare field 9
RefTransType         - Referenced source transaction type
RefTransDoc          - Referenced source document number
RefTransLine         - Referenced source line number
RefLineNumber        - Referenced source sub-line number
AddedBy              - User who created the record
AddedDate            - Record creation date
LastEditedBy         - User who last modified the record
LastEditedDate       - Date of last modification
BarcodeNo            - Assigned barcode number
SubmittedDate        - Date submitted for processing
PutawayDate          - Date placed in storage location
WarehouseCode        - Warehouse facility code
PalletPicking        - Pallet-level picking flag
ReceivingFindings    - Inspection notes from receiving
CustomerC            - Customer code who owns the inventory
HoldStatus           - Current hold status
AllocatedQty         - Quantity allocated to outbound
AllocatedKilo        - Weight allocated to outbound
AllocatedDoc         - Outbound document for this allocation
BatchComi            - Batch commingling reference
ComiRef              - Commingling reference code
OriginalTransdoc     - Original document before modification
OriginalTransLine    - Original line before modification


Table: WMS.Inbound

DocNumber                - Unique inbound document number
CustomerCode             - Owner customer code
WarehouseCode            - Receiving warehouse facility code
DocDate                  - Document creation date
ICNNumber                - Inbound control number
TranType                 - Inbound transaction mode
Plant                    - Handling plant or contractor name
RoomCode                 - Cold storage room assigned
DRNumber                 - Delivery receipt number
ContainerTemp            - Container temperature on arrival
Driver                   - Delivery driver name or N/A
ContainerNo              - Container identifier
ContactingDept           - Coordinating department
InvoiceNo                - Supplier invoice number
PlateNo                  - Vehicle plate number or N/A
SealNo                   - Container seal number
Supplier                 - Supplier or shipper name
AWB                      - Air waybill number
Trucker                  - Trucking company name
DocumentationStaff       - Documentation handler
WarehouseChecker         - Checker who inspected goods
GuardOnDuty              - Security guard during receiving
CustomerRepresentative   - Customer rep present at receiving
ApprovingOfficer         - Officer who approved the inbound
Arrival                  - Shipment arrival date and time
Departure                - Vehicle departure date and time
StartUnload              - Unloading start date and time
CompleteUnload           - Unloading completion date and time
PutAwayBy                - Numeric user ID who performed put-away
PutAwayDate              - Put-away completion date
PutAwayStrategy          - Put-away strategy applied
IsNoCharge               - Free of charge flag
Packing                  - Packing type or method
AssignLoc                - Assigned storage zone
ICNTotalQty              - Total quantity received
AddedBy                  - Numeric user ID who created the record
AddedDate                - Record creation date
LastEditedBy             - User who last modified the record
LastEditedDate           - Date of last modification
SubmittedBy              - User who submitted the document
SubmittedDate            - Document submission date
PostedBy                 - User who posted the document
PostedDate               - Document posting date
IsValidated              - Validation flag
IsWithDetail             - Line item details exist flag
Field1                   - Custom spare field 1
Field2                   - Custom spare field 2
Field3                   - Custom spare field 3
Field4                   - Custom spare field 4
Field5                   - Custom spare field 5
Field6                   - Custom spare field 6
Field7                   - Custom spare field 7
Field8                   - Custom spare field 8
Field9                   - Custom spare field 9
ApprovedBy               - User who approved the document
ApprovedDate             - Approval date
IsPrinted                - Printed flag
GeneratedDate            - System generation date
PrintCount               - Number of times printed
ProdNumber               - Production order number
StorageType              - Storage temperature type
IsService                - Service transaction integer flag
DirectOutbound           - Direct transfer to outbound integer flag
WeekNo                   - Week number for scheduling
TruckNo                  - Truck identifier
Remarks                  - General notes
UserId                   - System user ID
AcceptBy                 - User who accepted the document
AcceptDate               - Acceptance date
RejectBy                 - User who rejected the document
RejectDate               - Rejection date
CheckerAssignedDate      - Date checker was assigned
RFPutAwayBy              - RF user who performed put-away
RFPutAwayDate            - RF put-away date
DeliveryDate             - Delivery date
DockingTime              - Vehicle docking time
CheckingStart            - Goods checking start date and time
CheckingEnd              - Goods checking end date and time
EndProcessing            - Processing end date and time
StartProcessing          - Processing start date and time
HoldReason               - Reason for hold
HoldRemarks              - Additional hold remarks
HoldDate                 - Date hold was applied
UnHoldDate               - Date hold was lifted
HoldDuration             - Duration of hold
HoldStatus               - Current hold status
Status                   - Current document status
CheckedBy                - User who performed physical check
InternalExternal         - Internal or external transaction
LoadingBay               - Loading bay number used
AuthorizeBy              - User who authorized the transaction
DwellTime                - Total vehicle time at facility
DocumentBy               - User responsible for documentation
CancelledBy              - User who cancelled the document
CancelledDate            - Cancellation date
CompleteUnloadBY         - User who completed unloading
CheckerTransact          - Checker for this transaction
BlastReq                 - Blast freezing requested flag
TDRnumber                - Temperature deviation report number
TDocumentedBy            - Temperature records documenter
Tdocument                - Temperature document reference
TOrderFullfilment        - Temperature order fulfillment reference
Tremarks                 - Temperature remarks
BlastedBy                - User who performed blast freezing
BlastedDate              - Blast freezing date
CleanInvoice             - Invoice verified flag
TruckerRepresentative    - Trucking company representative
AfterBlastBy             - User who handled goods after blasting
AfterBlastedDate         - After-blast handling completion date
HandlingInPt             - Handling instructions at entry point
ArrivedBy                - User who recorded arrival
ICNPortalCreatedDate     - ICN portal creation date
ICNPortalSubmitted       - ICN portal submission flag or date
ResetBy                  - User who reset the document
ResetDate                - Document reset date
PutAwayStatus            - Current put-away status
UncancelledDate          - Cancellation reversal date
UncancelledBy            - User who reversed cancellation
ImportedDate             - Record import date
NonConformance           - Non-conformance found flag
NCR                      - Non-conformance report number
Stripping                - Container stripping flag
Sorting                  - Sorting required flag
RowVer                   - Row version for concurrency control
IsTruckMonitored         - Truck temperature monitoring flag

Table: WMS.Outbound

DocNumber              - Unique outbound document number
DocDate                - Document creation date
WarehouseCode          - Dispatching warehouse facility code
Customer               - Customer code for the outbound
TargetDate             - Target dispatch or delivery date
IsNoCharge             - Free of charge flag
DeliverTo              - Delivery destination name
DeliveryAddress        - Full delivery address
TruckingCo             - Trucking company name
PlateNumber            - Vehicle plate number or N/A
Driver                 - Driver name or N/A
WarehouseChecker       - Checker who inspected outbound goods
DocumentStaff          - Documentation handler
StartLoading           - Loading start date and time
CompleteLoading        - Loading completion date and time
ContainerNumber        - Container identifier
SealNumber             - Container seal number
OtherReference         - Additional reference number
AddedBy                - Numeric user ID who created the record
AddedDate              - Record creation date
LastEditedBy           - User who last modified the record
LastEditedDate         - Date of last modification
SubmittedBy            - User who submitted the document
SubmittedDate          - Document submission date
PostedBy               - User who posted the document
PostedDate             - Document posting date
IsValidated            - Validation flag
IsWithDetail           - Line item details exist flag
Field1                 - Custom spare field 1
Field2                 - Custom spare field 2
Field3                 - Custom spare field 3
Field4                 - Custom spare field 4
Field5                 - Custom spare field 5
Field6                 - Custom spare field 6
Field7                 - Custom spare field 7
Field8                 - Custom spare field 8
Field9                 - Custom spare field 9
SetBox                 - Number of set boxes
NetWeight              - Net shipment weight
NetVolume              - Net shipment volume
SMDeptSub              - Sales department subdivision reference
ModeofPayment          - Payment mode
ModeofShipment         - Shipment mode
Brand                  - Brand name of dispatched goods
TotalAmount            - Total declared monetary value
DeclaredValue          - Declared value for insurance or customs
TotalQty               - Total quantity in document
ForwarderTR            - Freight forwarder tracking reference
WayBillRemarks         - Waybill remarks
WayBillDate            - Waybill date
IsPrinted              - Printed flag
PrintCount             - Number of times printed
AllocationDate         - Goods allocation date
StorageType            - Storage temperature type
AcceptBy               - User who accepted the document
AcceptDate             - Acceptance date
RejectBy               - User who rejected the document
RejectDate             - Rejection date
CheckerAssignedDate    - Date checker was assigned
RFCheckBy              - RF user who performed check
RFCheckDate            - RF check date
ArrivalTime            - Truck arrival time
DockingTime            - Truck docking time
CheckingStart          - Checking start date and time
CheckingEnd            - Checking end date and time
StartProcessing        - Processing start date and time
EndProcessing          - Processing end date and time
DepartureTime          - Truck departure time
HoldReason             - Reason for hold
HoldRemarks            - Additional hold remarks
HoldDate               - Date hold was applied
UnHoldDate             - Date hold was lifted
HoldDuration           - Duration of hold
Status                 - Current document status
HoldStatus             - Current hold status
CheckedBy              - User who performed physical check
InternalExternal       - Internal or external transaction
LoadingBay             - Loading bay number used
Consignee              - Consignee name
Overtime               - Overtime indicator
ConsigneeAddress       - Consignee address
AddtionalManpower      - Additional manpower indicator
SuppliedBy             - Manpower or resource supplier
NOManpower             - Number of manpower assigned
TruckProviderByMets    - Truck provider name or indicator
TrackingNO             - Shipment tracking number
CompanyDept            - Requesting company department
ShipmentType           - Free-text shipment type description
RefDoc                 - Reference document number
TruckType              - Truck type
DwellTime              - Total truck time at facility
ApprovingOfficer       - Approving officer
CheckerTransact        - Checker for this transaction
CancelledBy            - User who cancelled the document
CancelledDate          - Cancellation date
Remarksout             - Outbound-specific remarks
TDRnumber              - Temperature deviation report number
TDocumentedBy          - Temperature records documenter
Tdocument              - Temperature document reference
TOrderFullfilment      - Temperature order fulfillment reference
Tremarks               - Temperature remarks
HIHO                   - High In High Out handling flag
CleanInvoice           - Invoice verified flag
TruckerRepresentative  - Trucking company representative
ArrivedBy              - User who recorded truck arrival
OCNPortalCreatedDate   - OCN portal creation date
OCNPortalSubmitted     - OCN portal submission flag or date
PickToLoad             - Pick-to-load process flag
MTV                    - Motorized transport vehicle reference
IsDistri               - Distribution order flag
UncancelledBy          - User who reversed cancellation
UncancelledDate        - Cancellation reversal date
UncancelledFrom        - Status before reversal
CancelledFrom          - Status at time of cancellation
SONumber               - Linked sales order number
OutletHead             - Head of receiving outlet
Notes                  - General notes
Wave                   - Wave number for batch picking
IsLead                 - Lead outbound document flag
IsWave                 - Wave picking flag
ContainNum             - Container count


Table: WMS.InboundDetail

DocNumber               - Parent inbound document number
LineNumber              - Line number in the document
ItemCode                - Product identifier code
ColorCode               - Color variant code
ClassCode               - Classification code
SizeCode                - Size variant code
BulkQty                 - Expected bulk quantity
BulkUnit                - Bulk unit of measure
ReceivedQty             - Actual received quantity
Unit                    - Base unit of measure
ExpiryDate              - Item expiry date
BatchNumber             - Batch ID or damage notation
ManufacturingDate       - Manufacturing date
ToLocation              - Lot reference or destination bin
PalletID                - Assigned pallet identifier
LotID                   - Lot identifier for traceability
RRDocDate               - Receiving report document date
PickedQty               - Quantity picked from this line
Remarks                 - Line item notes
BaseQty                 - Quantity in base units
StatusCode              - String status code
BarcodeNo               - Item or pallet barcode
Field1                  - Custom spare field 1
Field2                  - Custom spare field 2
Field3                  - Custom spare field 3
Field4                  - Custom spare field 4
Field5                  - Custom spare field 5
Field6                  - Custom spare field 6
Field7                  - Custom spare field 7
Field8                  - Custom spare field 8
Field9                  - Custom spare field 9
Status                  - Current line status
Strategy                - Single-character put-away strategy code
ICNQty                  - ICN quantity for this line
PlantCode               - Plant code for the item
CheckerPutawayBy        - Checker who verified put-away
CheckerPutawayDate      - Put-away verification date
OriginalLineNumber      - Line number before modification
SubLineNumber           - Sub-line for split or partial lines
SpecialHandlingInstruc  - Special handling instructions
Findings                - Receiving inspection findings
HoldBy                  - User who placed item on hold
HoldDate                - Date item was placed on hold
BlastedBy               - User who performed blast freezing
BlastedDate             - Blast freezing date
NCRRemarks              - Non-conformance report remarks
BlastOnRF               - Blast triggered via RF flag
AfterBlastBy            - User who handled item after blasting
AfterBlastedDate        - After-blast handling completion date
IsPartial               - Partial receipt flag
isConfirmed             - Line confirmed flag


Table: WMS.OutboundDetail

DocNumber          - Parent outbound document number
LineNumber         - Line number in the document
PicklistNo         - Picklist document number referencing parent OCN
ItemCode           - Product identifier code
ColorCode          - Color variant code
ClassCode          - Classification code
SizeCode           - Size variant code
BulkQty            - Requested bulk quantity
BulkUnit           - Bulk unit of measure
PicklistQty        - Quantity assigned to picklist
Unit               - Base unit of measure
BaseQty            - Quantity in base units
StatusCode         - String status code
BarcodeNo          - Item or pallet barcode
Field1             -  Batch Number
Field2             - Custom spare field 2
Field3             - Custom spare field 3
Field4             - Custom spare field 4
Field5             - Custom spare field 5
Field6             - Custom spare field 6
Field7             - Custom spare field 7
Field8             - Custom spare field 8
Field9             - Custom spare field 9
PickLineNumber     - Picklist line number
Price              - Unit price
Remarks            - General line remarks
OCNLineNumber      - OCN line number reference
OCNSubLineNumber   - OCN sub-line number reference
PalletID           - Source pallet identifier
Location           - Source warehouse bin
RFCheckBy          - RF user who verified the pick
RFCheckDate        - RF verification date
ItemReturn         - Item return flag or reference
Customer           - Customer code for this line
LastEditedBy       - User who last modified this line
LastEditedDate     - Date of last modification
Lottable02         - Lot ID
ReturnBulkQty      - Returned bulk quantity
ReturnBaseQty      - Returned base quantity
Mkfgdate           - Dispatched item manufacturing date
ExpiryDate         - Dispatched item expiry date
WarehouseChecker   - Checker who verified this line
Outlet             - Receiving outlet or store
DropNo             - Drop sequence number
DReport            - Delivery report reference
SpecialHandling    - Special handling instructions
Remarks1           - Additional remarks field 1
Remarks2           - Additional remarks field 2
RRDocdate          - Receiving report date reference
OldQty             - Quantity before modification
OldBulkQty         - Bulk quantity before modification
OldPalletID        - Pallet ID before reassignment
PickedPalletID     - Actual pick pallet ID
IsNoChargeDetail   - Free of charge line flag
PalletCount        - Number of pallets for this line
BatchNumb          - Dispatched item batch number
SONum              - Sales order number
OutNotes           - Outbound line notes
DRemarks           - Delivery remarks
InboundDocNumber   - Source inbound document number


Output Format:

If valid question:
{
  "query": "SQL query here"
}

If invalid question:
{
    "message": Give a friendly, conversational reply when no data is available or the question doesn’t make sense."
}
            `,
            input: question
        });

        const responseText = response.output_text.trim();
        const responseJson = JSON.parse(responseText);
        return responseJson;

    } catch (err) {
        return {
            success: false, 
            message: 'GenerateSQL failed', 
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

|DocDate             |
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
- If the data is empty (0 rows or empty array), respond with one sentence saying no records were found.

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
        return {
            success: false, 
            message: 'FormatSQL failed', 
            error: err.message 
        };
    }
}

async function generateTitle(question) {
    try {
        const response = await openai.responses.create({
            model: "gpt-4o-mini",
            instructions: `
You generate a short title for a chat conversation.

Rules:
- Maximum 4 words
- Based only on the user question
- No punctuation
- No quotes
Return only the title text.
            `,
            input: question
        });

        return response.output_text.trim();

    } catch (err) {
        return "New Conversation";
    }
}

async function runAi(question, conversation_id, conversation_title) {
    try {

        if (!conversation_title) {
            conversation_title = await generateTitle(question);
        }

        const generatedSqlOutput = await generateSQL(question);

        // AI could not generate SQL
        if (!generatedSqlOutput || !generatedSqlOutput.query) {
            return {
                success: false, 
                sql: null, 
                title: conversation_title,
                data: generatedSqlOutput?.message,
                error: "SQL generation failed" 
            };
        }

        const results = await runQuery(generatedSqlOutput.query);

        // SQL execution failed
        if (!results.success) {
            return {
                success: false,
                sql: generatedSqlOutput.query,
                title: conversation_title,
                data:  "Cannot run the query. Try again.",
                error: results.error
            };
        }

        const formatted = await formatSQL(results.data, question);

        return {
            sql: generatedSqlOutput.query,
            success: true,
            title: conversation_title,
            data: formatted
        };

    } catch (err) {
        return {
            success: false,
            sql: null,
            title: conversation_title || null,
            data: null,
            error: err.message || "Failed to run AI process"
        };
    }
}

module.exports = { 
    generateSQL, 
    generateTitle,
    formatSQL, 
    runAi
};