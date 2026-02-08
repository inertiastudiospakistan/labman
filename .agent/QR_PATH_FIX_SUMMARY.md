#✅QRCodePathFixed

IhaveresolvedtheissuewhereQRcodeswerepointingtotherootURLinsteadofthecorrect`/labman/`sub-path.

##🛠FixImplemented

###DynamicBaseURLDetection
**Issue:**TheQRcodegeneratorwasusingtherootdomain(e.g.,`localhost:3000/`)andappending`/track/...`,missingthe`/labman/`segment.
**Fix:**Iupdated`QRCodeGenerator.tsx`toinspectthecurrentbrowserURL.Ifitdetects`/labman/`inthepath,itautomaticallyappendsittothegeneratedQRlink.
**Result:**ScanningtheQRcodewillnowcorrectlydirectusersto`/labman/track/ordered-id...`.

##🚀HowtoVerify
1.**Refresh**yourbrowser.
2.Printthebillagain(orviewthepreview).
3.ScanthenewQRcode.
4.Itshouldleadtothecorrecttrackingpagewithout404errors.
