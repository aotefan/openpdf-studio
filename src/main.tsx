import {createRoot} from 'react-dom/client';import {initLanguage} from './i18n';import App from './ui/App';import './ui/styles.css';
initLanguage().then(()=>createRoot(document.getElementById('root')!).render(<App/>));
