import {applyGlossaryTermsWithTerms, hasGluedToken} from './tm.mjs';
const terms=[{source:'port',target:'埠'},{source:'log',target:'日誌'},{source:'client',target:'用戶端'},{source:'interface',target:'介面'},{source:'user',target:'使用者'},{source:'protocol',target:'協定'}];
const cases=[
 ['Use the port.','Use the 埠.'],
 ['export-passphrase','export-passphrase'],
 ['support@example.com','support@example.com'],
 ['login.html','login.html'],
 ['/interface/dot1x/client','/interface/dot1x/client'],
 ['link-login page','link-login page'],
 ['the login page','the 日誌 page'], // log inside login -> should NOT change -> 'the login page'
 ['The client is ready','The 用戶端 is ready'],
 ['`port=80` and port 80','`port=80` and 埠 80'],
 ['/docs/7.24/cli-reference/user/','/docs/7.24/cli-reference/user/'],
];
for(const [input,expected] of cases){const got=applyGlossaryTermsWithTerms(input,terms); console.log(got===expected?'OK':'FAIL',JSON.stringify(input),'=>',JSON.stringify(got),'expected',JSON.stringify(expected));}
console.log('glued ex埠-passphrase:',hasGluedToken('ex埠-passphrase'),'glued link-日誌in:',hasGluedToken('link-日誌in'),'clean 使用者:',hasGluedToken('使用者'));
