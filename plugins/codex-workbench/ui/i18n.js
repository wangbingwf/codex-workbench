let languagePreference='auto',hostLocale='',uiLocale='zh-CN';
let latestScope='',latestSync=0;
const staticTexts=[],staticAttributes=[];
const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
while(walker.nextNode()){const node=walker.currentNode;if(!node.parentElement.closest('script,style'))staticTexts.push([node,node.nodeValue]);}
for(const element of document.querySelectorAll('[title],[aria-label],[placeholder]'))for(const attr of ['title','aria-label','placeholder'])if(element.hasAttribute(attr))staticAttributes.push([element,attr,element.getAttribute(attr)]);
const translatedKeys=Object.keys(EN_STRINGS).sort((a,b)=>b.length-a.length);
const translatedPattern=new RegExp(translatedKeys.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
function tr(text){return uiLocale==='en'?text.replace(translatedPattern,key=>EN_STRINGS[key]):text;}
function effectiveLocale(){const preferred=languagePreference==='auto'?(hostLocale||navigator.languages?.[0]||navigator.language||'en'):languagePreference;return /^zh(?:-|$)/i.test(preferred)?'zh-CN':'en';}
function applyLanguage(){const locale=effectiveLocale(),changed=locale!==uiLocale;uiLocale=locale;document.documentElement.lang=locale;document.title=locale==='en'?'Codex Workbench':'Codex 工作台';for(const[node,text]of staticTexts)if(node.isConnected)node.nodeValue=tr(text);for(const[el,attr,text]of staticAttributes)if(el.isConnected)el.setAttribute(attr,tr(text));document.getElementById('language').value=languagePreference;if(changed&&typeof connected!=='undefined'&&connected){lastFiles=null;lastTask=null;lastProject=null;document.getElementById('refresh').textContent=tr(document.getElementById('refresh').disabled?'读取中…':'刷新数据');render();updateLocalizedMetadata();checkVersion();}}
function setHostLocale(locale){if(typeof locale==='string'&&locale){hostLocale=locale;applyLanguage();}}
function setLanguagePreference(value){languagePreference=['auto','zh-CN','en'].includes(value)?value:'auto';applyLanguage();}
document.getElementById('language').onchange=async e=>{const previous=languagePreference;setLanguagePreference(e.target.value);try{await call('workbench_onboarding',{action:'language',language:languagePreference});const start=document.getElementById('startExperience');if(start&&!start.disabled&&!start.hidden)await setupOnboarding();}catch(error){setLanguagePreference(previous);document.getElementById('message').textContent=error.message;}};
window.addEventListener('languagechange',()=>applyLanguage());
// Initial localization runs after app.js declares its state.
queueMicrotask(applyLanguage);

function updateLocalizedMetadata(){if(!latestSync)return;document.getElementById('sync').textContent=tr('同步 ')+shortTime(latestSync/1000);document.getElementById('sync').title=tr('数据同步：')+fmt(latestSync/1000)+tr(' · 北京时间');document.getElementById('scope').textContent=tr(latestScope)+tr('。读取不调用模型；摘要需明确同意后生成，使用 Codex 额度。');}
