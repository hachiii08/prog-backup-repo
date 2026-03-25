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
RecordId
TransType 
TransDoc
TransLine
LineNumber
ItemCode
ColorCode
ClassCode
SizeCode
PalletID
BatchNumber
Location
ExpirationDate
MfgDate
RRdate
OriginalBulkQty
OriginalBaseQty
OriginalLocation
RemainingBulkQty
RemainingBaseQty
PickedBulkQty
PickedBaseQty
ReservedBulkQty
ReservedBaseQty
OriginalCost
UnitCost
Field1
Field2
Field3
Field4
Field5
Field6
Field7
Field8
Field9
RefTransType
RefTransDoc
RefTransLine
RefLineNumber
AddedBy
AddedDate
LastEditedBy
LastEditedDate
BarcodeNo
SubmittedDate
PutawayDate
WarehouseCode
PalletPicking
ReceivingFindings
CustomerC
HoldStatus
AllocatedQty
AllocatedKilo
AllocatedDoc
BatchComi
ComiRef
OriginalTransdoc
OriginalTransLine


Table: WMS.Inbound
DocNumber
CustomerCode
WarehouseCode
DocDate
ICNNumber
TranType
Plant
RoomCode
DRNumber
ContainerTemp
Driver
ContainerNo
ContactingDept
InvoiceNo
PlateNo
SealNo
Supplier
AWB
Trucker
DocumentationStaff
WarehouseChecker
GuardOnDuty
CustomerRepresentative
ApprovingOfficer
Arrival
Departure
StartUnload
CompleteUnload
PutAwayBy
PutAwayDate
PutAwayStrategy
IsNoCharge
Packing
AssignLoc
ICNTotalQty
AddedBy
AddedDate
LastEditedBy
LastEditedDate
SubmittedBy
SubmittedDate
PostedBy
PostedDate
IsValidated
IsWithDetail
Field1
Field2
Field3
Field4
Field5
Field6
Field7
Field8
Field9
ApprovedBy
ApprovedDate
IsPrinted
GeneratedDate
PrintCount
ProdNumber
StorageType
IsService
DirectOutbound
WeekNo
TruckNo
Remarks
UserId
AcceptBy
AcceptDate
RejectBy
RejectDate
CheckerAssignedDate
RFPutAwayBy
RFPutAwayDate
DeliveryDate
DockingTime
CheckingStart
CheckingEnd
EndProcessing
StartProcessing
HoldReason
HoldRemarks
HoldDate
UnHoldDate
HoldDuration
HoldStatus
Status
CheckedBy
InternalExternal
LoadingBay
AuthorizeBy
DwellTime
DocumentBy
CancelledBy
CancelledDate
CompleteUnloadBY
CheckerTransact
BlastReq
TDRnumber
TDocumentedBy
Tdocument
TOrderFullfilment
Tremarks
BlastedBy
BlastedDate
CleanInvoice
TruckerRepresentative
AfterBlastBy
AfterBlastedDate
HandlingInPt
ArrivedBy
ICNPortalCreatedDate
ICNPortalSubmitted
ResetBy
ResetDate
PutAwayStatus
UncancelledDate
UncancelledBy
ImportedDate
NonConformance
NCR
Stripping
Sorting
RowVer
IsTruckMonitored


Table: WMS.Outbound
DocNumber
DocDate
WarehouseCode
Customer
TargetDate
IsNoCharge
DeliverTo
DeliveryAddress
TruckingCo
PlateNumber
Driver
WarehouseChecker
DocumentStaff
StartLoading
CompleteLoading
ContainerNumber
SealNumber
OtherReference
AddedBy
AddedDate
LastEditedBy
LastEditedDate
SubmittedBy
SubmittedDate
PostedBy
PostedDate
IsValidated
IsWithDetail
Field1
Field2
Field3
Field4
Field5
Field6
Field7
Field8
Field9
SetBox
NetWeight
NetVolume
SMDeptSub
ModeofPayment
ModeofShipment
Brand
TotalAmount
DeclaredValue
TotalQty
ForwarderTR
WayBillRemarks
WayBillDate
IsPrinted
PrintCount
AllocationDate
StorageType
AcceptBy
AcceptDate
RejectBy
RejectDate
CheckerAssignedDate
RFCheckBy
RFCheckDate
ArrivalTime
DockingTime
CheckingEnd
CheckingStart
EndProcessing
StartProcessing
DepartureTime
HoldReason
HoldRemarks
HoldDate
UnHoldDate
HoldDuration
Status
HoldStatus
CheckedBy
InternalExternal
LoadingBay
Consignee
Overtime
ConsigneeAddress
AddtionalManpower
SuppliedBy
NOManpower
TruckProviderByMets
TrackingNO
CompanyDept
ShipmentType
RefDoc
TruckType
DwellTime
ApprovingOfficer
CheckerTransact
CancelledBy
CancelledDate
Remarksout
TDRnumber
TDocumentedBy
Tdocument
TOrderFullfilment
Tremarks
HIHO
CleanInvoice
TruckerRepresentative
ArrivedBy
OCNPortalCreatedDate
OCNPortalSubmitted
PickToLoad
MTV
IsDistri
UncancelledBy
UncancelledDate
UncancelledFrom
CancelledFrom
SONumber
OutletHead
Notes
Wave
IsLead
IsWave
ContainNum


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



uyfcuwghfikwnfkw ifg89hjw
fbwtfgyudhiowemkefkjwe
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