import {createRoot} from 'react-dom/client';
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css';
import 'lxgw-wenkai-webfont/lxgwwenkai-bold.css';
import './brush.css';
import './styles.css';
import {App} from './App';
import {boot} from './store';
import './update';

void boot().then(()=>createRoot(document.getElementById('root')!).render(<App/>));
