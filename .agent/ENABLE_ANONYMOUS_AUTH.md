#⚠Critical:EnableAnonymousAuthentication

The"Invalidorexpiredtrackinglink"errorandthe"brokenQRcode"behaviorarecausedbyamissingconfigurationinyourFirebaseproject.

Yourapplicationlogsshow:`Firebase:Error(auth/configuration-not-found).`

Thismeans**AnonymousSign-In**isdisabled,sothepubliccannotaccessthedatabasetoverifytheQRtoken.

##🛠HowtoFix(Required)

1.Gotothe[FirebaseConsole](https://console.firebase.google.com/).
2.Openyourproject.
3.Navigateto**Authentication**>**Sign-inmethod**.
4.Find**Anonymous**inthelistofproviders.
5.Clickthe**Edit**(pencil)icon.
6.Toggle**Enable**toON.
7.Click**Save**.

##✅Verification
Onceenabled:
1.Refreshyourapplicationpage.
2.ScanaQRcodefromabillorreport.
3.Thetrackingpageshouldnowloadcorrectlywithoutthe"AccessError".

##ℹNoteonCodeFixes
Ihavealsoupdatedthecode(`qrTokenUtils.ts`)toensuretheQRvalidationquerystrictlymatchesyoursecurityrules.ThiswillensuresmoothoperationonceAuthenticationisenabled.
