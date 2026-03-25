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

WMS.CountSheetSetup{
RecordId=unique id; TransType=txn type; TransDoc=src doc; TransLine=txn line; LineNumber=seq line;
ItemCode=product; ColorCode=color; ClassCode=class; SizeCode=size; PalletID=pallet; BatchNumber=batch;
Location=bin; ExpirationDate=expiry; MfgDate=mfg; RRdate=rr date;
OriginalBulkQty=init bulk; OriginalBaseQty=init base; OriginalLocation=orig bin;
RemainingBulkQty=curr bulk; RemainingBaseQty=curr base;
PickedBulkQty=picked bulk; PickedBaseQty=picked base;
ReservedBulkQty=reserved bulk; ReservedBaseQty=reserved base;
OriginalCost=recv cost; UnitCost=unit cost;
Field1-2,4-9=custom; Field3=lot id;
RefTransType=ref type; RefTransDoc=ref doc; RefTransLine=ref line; RefLineNumber=ref subline;
AddedBy,AddedDate=created; LastEditedBy,LastEditedDate=modified;
BarcodeNo=barcode; SubmittedDate=submitted; PutawayDate=putaway;
WarehouseCode=warehouse; PalletPicking=flag;
ReceivingFindings=inspection; CustomerC=customer; HoldStatus=hold;
AllocatedQty=alloc qty; AllocatedKilo=alloc wt; AllocatedDoc=alloc doc;
BatchComi=batch commingle; ComiRef=commingle ref;
OriginalTransdoc=orig doc; OriginalTransLine=orig line;
}

WMS.Inbound{
DocNumber=doc; CustomerCode=customer; WarehouseCode=warehouse; DocDate=date;
ICNNumber=icn; TranType=type; Plant=plant; RoomCode=room;
DRNumber=dr; ContainerTemp=temp; Driver=driver; ContainerNo=container;
ContactingDept=dept; InvoiceNo=invoice; PlateNo=plate; SealNo=seal;
Supplier=supplier; AWB=awb; Trucker=trucker;
DocumentationStaff=doc staff; WarehouseChecker=checker; GuardOnDuty=guard;
CustomerRepresentative=customer rep; ApprovingOfficer=approver;
Arrival,Departure,StartUnload,CompleteUnload=datetime;
PutAwayBy=putaway user; PutAwayDate=putaway; PutAwayStrategy=strategy;
IsNoCharge=flag; Packing=packing; AssignLoc=zone; ICNTotalQty=total qty;
AddedBy,AddedDate=created; LastEditedBy,LastEditedDate=modified;
SubmittedBy,SubmittedDate=submitted; PostedBy,PostedDate=posted;
IsValidated=flag; IsWithDetail=flag; Field1-9=custom;
ApprovedBy,ApprovedDate=approved;
IsPrinted=flag; GeneratedDate=generated; PrintCount=count;
ProdNumber=prod order; StorageType=temp type;
IsService,DirectOutbound=flags;
WeekNo=week; TruckNo=truck; Remarks=notes; UserId=user;
AcceptBy,AcceptDate=accepted; RejectBy,RejectDate=rejected;
CheckerAssignedDate=checker assigned;
RFPutAwayBy,RFPutAwayDate=rf putaway;
DeliveryDate=delivery; DockingTime=dock;
CheckingStart,CheckingEnd=checking;
StartProcessing,EndProcessing=processing;
HoldReason=reason; HoldRemarks=notes;
HoldDate,UnHoldDate,HoldDuration=hold;
HoldStatus=hold; Status=status;
CheckedBy=checked; InternalExternal=type;
LoadingBay=bay; AuthorizeBy=authorized;
DwellTime=vehicle time; DocumentBy=doc;
CancelledBy,CancelledDate=cancel;
CompleteUnloadBY=unload by; CheckerTransact=checker;
BlastReq=flag; TDRnumber=temp report;
TDocumentedBy,Tdocument,TOrderFullfilment,Tremarks=temp;
BlastedBy,BlastedDate=blast;
CleanInvoice=verified; TruckerRepresentative=rep;
AfterBlastBy,AfterBlastedDate=post blast;
HandlingInPt=handling; ArrivedBy=arrival;
ICNPortalCreatedDate,ICNPortalSubmitted=portal;
ResetBy,ResetDate=reset;
PutAwayStatus=putaway status;
UncancelledBy,UncancelledDate=cancel reversal;
ImportedDate=import;
NonConformance=flag; NCR=ncr;
Stripping,Sorting=flags; RowVer=version;
IsTruckMonitored=monitor flag;
}

WMS.Outbound{
DocNumber=doc; DocDate=date; WarehouseCode=warehouse; Customer=customer;
TargetDate=target; IsNoCharge=flag;
DeliverTo=dest; DeliveryAddress=address;
TruckingCo=trucker; PlateNumber=plate; Driver=driver;
WarehouseChecker=checker; DocumentStaff=doc staff;
StartLoading,CompleteLoading=loading;
ContainerNumber=container; SealNumber=seal;
OtherReference=ref;
AddedBy,AddedDate=created; LastEditedBy,LastEditedDate=modified;
SubmittedBy,SubmittedDate=submitted; PostedBy,PostedDate=posted;
IsValidated,IsWithDetail=flags; Field1-9=custom;
SetBox=boxes; NetWeight=weight; NetVolume=volume;
SMDeptSub=dept; ModeofPayment=payment; ModeofShipment=shipment;
Brand=brand; TotalAmount=value; DeclaredValue=declared;
TotalQty=qty; ForwarderTR=tracking;
WayBillRemarks=notes; WayBillDate=date;
IsPrinted=flag; PrintCount=count;
AllocationDate=allocation; StorageType=temp type;
AcceptBy,AcceptDate=accepted; RejectBy,RejectDate=rejected;
CheckerAssignedDate=checker assigned;
RFCheckBy,RFCheckDate=rf check;
ArrivalTime,DockingTime=arrival;
CheckingStart,CheckingEnd=checking;
StartProcessing,EndProcessing=processing;
DepartureTime=departure;
HoldReason,HoldRemarks=hold;
HoldDate,UnHoldDate,HoldDuration=hold;
Status=status; HoldStatus=hold;
CheckedBy=checked; InternalExternal=type;
LoadingBay=bay; Consignee=consignee;
Overtime=flag; ConsigneeAddress=address;
AddtionalManpower=extra manpower; SuppliedBy=supplier;
NOManpower=count; TruckProviderByMets=provider;
TrackingNO=tracking; CompanyDept=dept;
ShipmentType=type; RefDoc=ref;
TruckType=truck; DwellTime=time;
ApprovingOfficer=approver; CheckerTransact=checker;
CancelledBy,CancelledDate=cancel;
Remarksout=notes;
TDRnumber,TDocumentedBy,Tdocument,TOrderFullfilment,Tremarks=temp;
HIHO=flag; CleanInvoice=verified;
TruckerRepresentative=rep; ArrivedBy=arrival;
OCNPortalCreatedDate,OCNPortalSubmitted=portal;
PickToLoad=flag; MTV=transport;
IsDistri=flag;
UncancelledBy,UncancelledDate=cancel reversal;
UncancelledFrom,CancelledFrom=status;
SONumber=so; OutletHead=outlet;
Notes=notes; Wave=wave;
IsLead,IsWave=flags;
ContainNum=container count;
}

WMS.InboundDetail{
DocNumber=parent inbound doc; LineNumber=line;
ItemCode=product; ColorCode=color; ClassCode=class; SizeCode=size;
BulkQty=expected bulk; BulkUnit=bulk uom;
ReceivedQty=actual qty; Unit=base uom;
ExpiryDate=expiry; BatchNumber=batch/damage; ManufacturingDate=mfg;
ToLocation=dest bin/lot; PalletID=pallet; LotID=lot;
RRDocDate=rr date;
PickedQty=picked; Remarks=notes;
BaseQty=base qty; StatusCode=code; BarcodeNo=barcode;
Field1-9=custom;
Status=status; Strategy=putaway strategy;
ICNQty=icn qty; PlantCode=plant;
CheckerPutawayBy,CheckerPutawayDate=putaway verify;
OriginalLineNumber=orig line; SubLineNumber=subline;
SpecialHandlingInstruc=handling; Findings=inspection;
HoldBy,HoldDate=hold;
BlastedBy,BlastedDate=blast;
NCRRemarks=ncr notes; BlastOnRF=rf blast;
AfterBlastBy,AfterBlastedDate=post blast;
IsPartial=flag; isConfirmed=flag;
}

WMS.OutboundDetail{
DocNumber=parent outbound doc; LineNumber=line;
PicklistNo=picklist; ItemCode=product; ColorCode=color; ClassCode=class; SizeCode=size;
BulkQty=requested bulk; BulkUnit=bulk uom;
PicklistQty=assigned; Unit=base uom; BaseQty=base qty;
StatusCode=code; BarcodeNo=barcode;
Field1=batch number; Field2-9=custom;
PickLineNumber=pick line; Price=unit price; Remarks=notes;
OCNLineNumber=ocn line; OCNSubLineNumber=ocn subline;
PalletID=source pallet; Location=source bin;
RFCheckBy,RFCheckDate=rf check;
ItemReturn=return ref; Customer=customer;
LastEditedBy,LastEditedDate=modified;
Lottable02=lot id;
ReturnBulkQty,ReturnBaseQty=returns;
Mkfgdate=mfg; ExpiryDate=expiry;
WarehouseChecker=checker;
Outlet=outlet; DropNo=drop seq;
DReport=delivery report;
SpecialHandling=handling;
Remarks1,Remarks2=notes;
RRDocdate=rr date;
OldQty,OldBulkQty=prev qty;
OldPalletID=prev pallet; PickedPalletID=actual pallet;
IsNoChargeDetail=flag;
PalletCount=count;
BatchNumb=batch;
SONum=so;
OutNotes=notes;
DRemarks=delivery notes;
InboundDocNumber=source inbound;
}



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