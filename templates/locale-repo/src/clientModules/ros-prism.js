import {Prism} from 'prism-react-renderer';
import {registerRosGrammar} from '../prism/ros.js';

// `ros`, `routeros` and `mikrotik` all resolve to the same RouterOS grammar, so
// the highlighted markup matches the official manual token for token.
registerRosGrammar(Prism);
