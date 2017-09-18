### download
-------
```js
npm i --save mongoose-auto-increment-2
```

### why
-------
1. the available mongoose auto increment plugins seem to not be maintained.
2. none of them use a sparse index, which can lead to chaos in case of null fields.
3. none of the plugins self heal the index.
4. no ability to change name of counters collection, which could matter for some people.
5. none prevent modification of the index field


### usage
-------

**plugin usage**
```js

var mongoose = require('mongoose');
var autoincrement = require('mongoose-auto-increment-2');
var PersonSchema = new mongoose.Schema({
     name : { type: String }
});

PersonSchema.plugin(autoincrement,{ field: 'id' });

var Person = mongoose.model('Person',PersonSchema);
```

**healing collection**
```js
var Person = require('mongoose').model('Person');
//selfheal collection
Person.heal().then((numSaved)=>{
    console.log('%d documents healed',numSaved);
});
```
**changing name of collection**
```js
var autoincrement = require('mongoose-auto-increment-2');
autoincrement.setCollection('custom-counters');
```