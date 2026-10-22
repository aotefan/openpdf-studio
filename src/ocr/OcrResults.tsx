import {useTranslation} from 'react-i18next';
import type {OcrPage} from '../types';
export default function OcrResults({pages}:{pages:OcrPage[]}){
 const {t}=useTranslation();return <div className="ocr-results"><table><thead><tr><th>{t('page')}</th><th>{t('ocrStatus')}</th><th>{t('ocrLines')}</th><th>{t('ocrSample')}</th></tr></thead><tbody>{pages.map(row=><tr key={row.page} data-ocr-page={row.page+1}><td>{row.page+1}</td><td>{t('ocr.status.'+row.status)}{row.lowConfidence>0&&<small>{t('ocrLowConfidence',{count:row.lowConfidence})}</small>}</td><td>{row.lines||'—'}</td><td>{row.sample||'—'}</td></tr>)}</tbody></table></div>;
}
