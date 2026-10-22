import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from './en-US.json';import zh from './zh-CN.json';
export async function initLanguage(){
 const system=await window.studio.language();
 await i18n.use(initReactI18next).init({resources:{'en-US':{translation:en},'zh-CN':{translation:zh}},lng:localStorage.getItem('language')||(system.startsWith('zh')?'zh-CN':'en-US'),fallbackLng:'en-US',interpolation:{escapeValue:false},returnNull:false});
 i18n.on('languageChanged',lng=>{window.studio.setLocale(lng);localStorage.setItem('language',lng);document.documentElement.lang=lng;});document.documentElement.lang=i18n.language;await window.studio.setLocale(i18n.language);
}
export default i18n;
