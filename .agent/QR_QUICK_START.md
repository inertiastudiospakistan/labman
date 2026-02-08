#QRSystem-QuickStartGuide

##🎯ReadytoBegin?StartHere!

ThisguidewillhelpyouimplementtheQR/Barcodesystemstep-by-step.

---

##📋Pre-ImplementationChecklist

Beforewestartcoding,pleaseconfirm:

-[]**Reviewthemockups**(seegeneratedimages)
-LiveStatusPagemockup
-BillwithQRcodemockup

-[]**Chooseimplementationapproach:**
-[]FullImplementation(5weeks,allfeatures)
-[]MVP(3weeks,corefeaturesonly)
-[]PhasedRollout(incremental)

-[]**Decideonsettings:**
-QRpositiononbill:`top-right`|`top-left`|`bottom-right`|`bottom-left`
-QRsize:`100px`|`150px`|`200px`
-Passcodeprotection:`yes`|`no`
-Tokenexpiry:`never`|`30days`|`90days`

---

##🚀Phase1:Foundation(Week1)

###Step1.1:InstallDependencies

```bash
#InstallQRcodelibrary
npminstallqrcode@types/qrcode

#Verifyinstallation
npmlistqrcode
```

**Expectedoutput:**`qrcode@1.5.x`

---

###Step1.2:CreateUtilityFiles

####File:`qrTokenUtils.ts`

Thisfilehandles:
-Tokengeneration(secureUUID)
-Tokenvalidation
-Firestoreinteractions
-Accesslogging

**Whatitdoes:**
```typescript
//Generatesecuretoken
consttoken=awaitcreateQRToken(orderId,patientId,'bill');

//Validatetoken
constisValid=awaitvalidateQRToken(token);

//Getorderdatabytoken
constorderData=awaitgetOrderDataByToken(token);

//Revoketoken
awaitrevokeQRToken(token,userId);
```

---

###Step1.3:DatabaseSchemaSetup

**Collection:`qr_tokens`**

Fields:
-`token`(string)-UUIDv4
-`type`('bill'|'report')
-`orderId`(string)
-`patientId`(string)
-`sampleIds`(arrayofstrings)
-`patientName`(string)-cached
-`isActive`(boolean)
-`createdAt`(timestamp)
-`expiresAt`(timestamp|null)
-`accessCount`(number)
-`lastAccessedAt`(timestamp)
-`requiresPasscode`(boolean)
-`passcode`(string,optional)

**FirestoreSecurityRules:**

```javascript
rules_version='2';
servicecloud.firestore{
match/databases/{database}/documents{

//Existingrules...

//QRTokens-Publicreadforactivetokens
match/qr_tokens/{tokenId}{
//Anyonecanreadactive,non-expiredtokens
allowread:ifresource.data.isActive==true
&&(resource.data.expiresAt==null||resource.data.expiresAt>request.time);

//Onlyauthenticateduserscanwrite
allowcreate,update,delete:ifrequest.auth!=null;
}

//QRAccessLogs-Onlyauthenticateduserscanwrite
match/qr_access_logs/{logId}{
allowread:ifrequest.auth!=null;
allowcreate:iftrue;//Allowpublictologaccess
}

//Allowpublicreadaccesstoorders/samplesviatokenvalidation
//Note:Validatetokeninapplicationlayerbeforefetching
match/orders/{orderId}{
allowread:ifrequest.auth!=null||exists(/databases/$(database)/documents/qr_tokens/$(orderId));
}

match/samples/{sampleId}{
allowread:ifrequest.auth!=null;//Tokenvalidationinapp
}
}
}
```

**Todeployrules:**FirebaseConsole→Firestore→Rules→Pasteabove→Publish

---

###Step1.4:CreateTokenManagerComponent

**Purpose:**Adminpagetoview/manageallQRtokens

**Location:**`Admin→Reports→QRTokens`

**Features:**
-Listalltokens
-Search/filter
-Viewaccesslogs
-Revoketokens
-Regeneratetokens

---

##🎨Phase2:QRCodeGeneration(Week2)

###Step2.1:BuildQRGeneratorComponent

**File:`QRCodeGenerator.tsx`**

```typescript
importQRCodefrom'qrcode';

interfaceProps{
token:string;
size?:number;
includeLabel?:boolean;
}

//GeneratesQRasDataURLforembeddinginPDFs/images
constgenerateQR=async(token:string)=>{
consturl=`${window.location.origin}/track/${token}`;
returnawaitQRCode.toDataURL(url,{
errorCorrectionLevel:'H',//Higherrorcorrection
margin:2,
width:150,
color:{
dark:'#000000',
light:'#FFFFFF'
}
});
};
```

---

###Step2.2:IntegratewithBillPrinting

**Modify:**`App.tsx`→`PrintInvoiceModal`

**Steps:**
1.Generate/retrieveQRtokenwhenopeninginvoicemodal
2.GenerateQRimageasDataURL
3.AddQRimagetoinvoicetemplate
4.Positionbasedonadminsettings

**Codelocationtomodify:**
```typescript
//InPrintInvoiceModalcomponent
//Aroundline~5500inApp.tsx

//Beforeprinting:
constqrToken=awaitgetOrCreateQRToken(order.id,order.patientId,'bill');
constqrImageUrl=awaitgenerateQR(qrToken);

//Passtotemplaterenderer
```

---

###Step2.3:IntegratewithReportDesigner

**Modify:**
-`ReportSchema.ts`-AddQRlayertype
-`ReportRendererCore.tsx`-RenderQRlayer
-`ReportDesigner.tsx`-AllowQRplacement

**Newlayertype:**
```typescript
interfaceQRCodeLayerextendsBaseReportLayer{
type:'qr_code';
props:{
tokenSource:'auto'|'manual';
size:number;
};
}
```

---

##📱Phase3:PublicPages(Week3)

###Step3.1:CreateLiveStatusPage

**File:**`LiveStatusPage.tsx`

**Route:**`/track/:token`

**Features:**
-Tokenvalidationonload
-Real-timeorder/sampledatafetching
-Auto-refreshevery30seconds
-ProgressstepperUI
-ETAcalculations
-Mobile-responsivedesign

**ComponentStructure:**
```tsx
<LiveStatusPage>
<Header>LabProPlusLogo</Header>
<PatientInfoCard/>
<ProgressSteppersteps={statusSteps}/>
<TestListtests={samples}/>
<DownloadButton/>{/*Onlyifreportready*/}
<ContactInfo/>
<AutoRefreshIndicator/>
</LiveStatusPage>
```

---

###Step3.2:CreateReportViewerPage

**File:**`ReportViewerPublic.tsx`

**Route:**`/view-report/:token`

**Features:**
-Tokenvalidation
-Reportrenderingusing`ReportRendererCore`
-DownloadPDFbutton
-Sharebuttons(WhatsApp,Email)
-Linkbacktostatuspage

---

###Step3.3:AddRoutestoApp

**Modify:**`App.tsx`→Addpublicroutes

```typescript
//InApp.tsx,addroutesaccessiblewithoutauthentication

<Routes>
{/*PublicRoutes*/}
<Routepath="/track/:token"element={<LiveStatusPage/>}/>
<Routepath="/view-report/:token"element={<ReportViewerPublic/>}/>

{/*Existingroutes...*/}
</Routes>
```

---

##⚙️Phase4:AdminModule(Week4)

###Step4.1:QRSettingsPanel

**Location:**`Admin→Settings→QRSystem`

**Settings:**
-Enable/DisableQRsystem
-BillQRposition
-BillQRsize
-ReportQRposition
-ReportQRsize
-Passcoderequirement
-Tokenexpiryduration
-Accesslogging

**Saveto:**`settings`collectioninFirestore

---

###Step4.2:TokenManagementDashboard

**Location:**`Admin→Reports→QRTokens`

**Tablecolumns:**
-Token(masked)
-PatientName
-OrderID
-Type(Bill/Report)
-CreatedDate
-AccessCount
-Status(Active/Revoked)
-Actions(ViewLogs,Revoke,Regenerate)

---

###Step4.3:AccessLogsViewer

**Features:**
-Filterbydaterange
-Filterbytoken/patient
-ViewIPaddresses(hashed)
-ExporttoCSV

---

##🧪Phase5:Testing(Week5)

###TestCases

####FunctionalTesting
-[]QRappearsonprintedbills
-[]QRappearsongeneratedreports
-[]ScanningQRopenscorrectpage
-[]Statusupdatesinreal-time
-[]Reportdownloadworks
-[]Admincanrevoketokens
-[]Revokedtokensshowerror

####SecurityTesting
-[]Invalidtokensshowerror
-[]Expiredtokensblocked
-[]NoPIIinQRcodes
-[]HTTPSenforced
-[]Firestorerulesworkcorrectly

####PerformanceTesting
-[]Pageloads<2seconds
-[]Auto-refreshdoesn'tlag
-[]Workson3Gnetwork
-[]Mobileresponsive

####BrowserTesting
-[]Chrome(desktop&mobile)
-[]Safari(iOS)
-[]Firefox
-[]Edge
-[]Low-endAndroidbrowsers

---

##📦Deployment

###Step1:BuildProductionBundle

```bash
npmrunbuild
```

###Step2:DeploytoFirebaseHosting

```bash
#Ifnotalreadyinitialized
firebaseinithosting

#Deploy
firebasedeploy--onlyhosting,firestore
```

###Step3:VerifyDeployment

1.Visit:`https://your-app.web.app/track/test-token`
2.Shouldshowerror:"Invalidtoken"(expected)
3.Generaterealtokenfromadminpanel
4.Testwithrealtoken

---

##🎉SuccessCriteria

Yourimplementationiscompletewhen:

✅**BillQR**
-[x]QRappearsoneveryprintedbill
-[x]Scanningopenslivestatuspage
-[x]Statusupdatesautomatically

✅**ReportQR**
-[x]QRappearsoneveryreport
-[x]Scanningopensreportviewer
-[x]Downloadworks

✅**Admin**
-[x]Settingspanelfunctional
-[x]Tokenmanagerworks
-[x]Canrevoketokens
-[x]Accesslogsvisible

✅**Security**
-[x]Tokensaresecure
-[x]NoPIIexposed
-[x]HTTPSenforced
-[x]Rulesdeployed

✅**UX**
-[x]Mobile-friendly
-[x]Fastloading
-[x]Clearinstructions
-[x]Beautifuldesign

---

##🆘Troubleshooting

###Issue:QRcodenotappearingonbill
**Solution:**CheckifQRtokenwascreated.Checkconsoleforerrors.

###Issue:"Invalidtoken"erroronstatuspage
**Solution:**VerifytokenexistsinFirestore.Checkifactive=true.

###Issue:Statusnotupdating
**Solution:**CheckFirestorerules.Ensurereal-timelistenerisactive.

###Issue:Reportdownloadfails
**Solution:**CheckjsPDFintegration.VerifyPDFgenerationworks.

###Issue:Adminpanelnotshowingtokens
**Solution:**Checkuserpermissions.VerifyFirestorequery.

---

##📞Support

Ifyouencounterissuesduringimplementation:

1.Checkthedetailedplan:`.agent/QR_SYSTEM_IMPLEMENTATION_PLAN.md`
2.Reviewmockupsfordesignreference
3.CheckFirestorerulesaredeployed
4.Verifynpmpackagesinstalledcorrectly
5.Askmeforhelp!I'mheretoassist.

---

##🚀ReadytoStart?

**NextStep:**Tellmewhichphaseyou'dliketobeginwith,andI'llcreatethecodefiles!

**Recommended:**StartwithPhase1(Foundation)tobuildthesolidbase.

Justsay:
-"Let'sstartwithPhase1"→I'llcreatetokenutilities
-"SkiptoPhase2"→I'llcreateQRgenerator
-"ShowmePhase3"→I'llbuildthepublicpages
-"Fullimplementation"→I'lldoeverythingstep-by-step

**Yourchoice!**🎯
