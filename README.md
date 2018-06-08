# pg-english

[![pg-english](https://i.imgur.com/UN74CCi.jpg)](https://npmjs.com/package/pg-english)

Convert [english query] to [informal] [SQL SELECT].
> NOTE: [pg-slang] can convert informal SQL to formal SQL.

```javascript
var english = require('pg-english');
// english.token([type], [value]): token
// english.number(<text>): processed text
// english.unit(<text>): processed text
// english.reserved(<text>): processed text
// english.entity(<text>, <match fn>, [this]): Promise (processed text)
// english(<text>, <match fn>, [this], [options])
// -> Promise (processed text)

// <match fn>(<texts>)
// - texts: array of text
// -> Promise {type, value, length}
// - type: token type (table/column/row)
// - value: token value
// - hint: token hint (identifies table)
// - length: token length (from start of texts)

// options: {
//   table: undefined,       // default table: none
//   columns: {<table>: []}, // default columns per table: none
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

Methods:
- [token](https://www.npmjs.com/package/@pg-english/token)
- [number](https://www.npmjs.com/package/@pg-english/number)
- [unit](https://www.npmjs.com/package/@pg-english/unit)
- [reserved](https://www.npmjs.com/package/@pg-english/reserved)
- [entity](https://www.npmjs.com/package/@pg-english/entity)


[english query]: https://www.nexthink.com/blog/natural-language-interfaces-to-databases-nlidb/
[informal]: https://www.npmjs.com/package/pg-slang
[SQL SELECT]: https://www.postgresql.org/docs/10/static/sql-select.html
[pg-slang]: https://www.npmjs.com/package/pg-slang
