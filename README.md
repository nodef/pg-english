# pg-english

English interface to PostgreSQL.

```javascript
var english = require('pg-english');
// english.token([type], [value]): token
// english.number(<text>): processed text
// english.unit(<text>): processed text
// english.reserved(<text>): processed text
// english.entity(<text>, <match fn>, [this]): Promise (processed text)
// english(<text>, <match fn>, [this], [options])
// -> Promise (processed text)

// options: {
//   table: undefined,  // default table: none
//   columns: [],       // default columns: none
// }


function match(txts) {
  var z = null, txt = txts.join(' ');
  if(txt.startsWith('ascorbic acid')) z = {type: 'column', value: 'ASCORBIC ACID', length: 2};
  else if(txt.startsWith('food')) z = {type: 'table', value: 'FOOD', length: 1};
  return Promise.resolve(z);
};
await english('show food with ascorbic acid less than twenty nine mg', match);
// SELECT "ASCORBIC ACID" FROM "FOOD" WHERE ("ASCORBIC ACID" < 0.029)
```
