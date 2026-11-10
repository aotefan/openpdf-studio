import {useTranslation} from 'react-i18next';

export default function ImageDpiSelect({value,onChange}:{value:number;onChange:(dpi:number)=>void}){
 const {t}=useTranslation();
 return <label>{t('imageResolution')}<select aria-label={t('imageResolution')} value={value} onChange={e=>onChange(Number(e.target.value))}>
  {[150,300,600].map(dpi=><option key={dpi} value={dpi}>{t('imageDpi'+dpi)}</option>)}
 </select></label>;
}
