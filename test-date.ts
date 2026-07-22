import { checkBoletoWarning } from './src/utils/dates';
console.log('Today:', new Date());
console.log('27:', checkBoletoWarning(27));
console.log('23:', checkBoletoWarning(23));
console.log('28:', checkBoletoWarning(28));
