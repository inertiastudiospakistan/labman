#✅QRCodeUnificationComplete

IhaveupdatedthesystemtoensurethattheQRcodeisconsistentacrossboththeBillandtheReportforeveryorder.

##🛠FixesImplemented

###UnifiedQRLogic
**Issue:**ThesystemwasgeneratingseparateQRcodesforBills(`/track/...`)andReports(`/view-report/...`),causingconfusion.
**Fix:**Istandardizedthesystemtousethe**OrderTracking**QRcode(`type='bill'`)forALLdocuments.
**Result:**
-TheQRcodeonthe**Bill**pointstotheOrderTrackingpage.
-TheQRcodeonthe**Report**nowALSOpointstotheOrderTrackingpage(whichcontainsthe"ViewReport"button).
-Thisensuresthe**QRImageisidentical**onbothdocumentsforthesameorder.

##🚀HowtoVerify
1.**Refresh**yourbrowser.
2.PrintaBill.
3.PrintaReport(orviewthepreview).
4.VisuallycomparetheQRcodes-theyshouldlookidentical.
5.Scanthem-bothshouldleadtothe**TrackingPage**.
