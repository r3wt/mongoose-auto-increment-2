// MIT LICENSE
// based on https://github.com/moltak/mongoose-autoincrement


const rx = require('rx');
const mongoose = require('mongoose');

var countersCollection = 'counters';

function autoIncrement(schema, options) {

    var field = {};
    var selfheal = options.selfheal || false;

    // swith to options field
    var fieldName = options.field || '_id';
    var filter = {};
    filter[fieldName] = {$type: 'number'};
    field[fieldName] = {
        type: Number,
        unique: true,
        partialFilterExpression: filter // index only applied if value is numeric.
        //thus no non numeric index errors!
    };

    console.log(field)

    schema.add(field);

    console.log(schema.obj);

    schema.pre('save', function (next) {
        console.log('pre.save');
        ready().then(()=>{

            var doc = this;
            if (doc.db && doc.isNew && typeof doc[fieldName] === 'undefined') {
                getNextSeqObservable(doc.db.db, doc.collection.name)
                .retryWhen(err => {
                    console.log(err);
                    return err;
                })
                .subscribe(seq => {
                    console.log(seq);
                    doc[fieldName] = seq;
                    next();
                });
            } else {
                //heal sets doc.__allowChange to true in order to bypass this check.
                if(!doc.__allowChange){
                    if(doc.isModified(fieldName)){
                        doc.invalidate(fieldName,'You may not modify the auto-increment field `'+fieldName+'` ');
                    }
                }
                next();
            }

        });
    });

    schema.statics.heal = function(){
        console.log('schema.statics.heal');
        return new Promise((resolve,reject)=>{

            ready().then(()=>{
            
        
                var filter1 = {},
                    filter2 = {};
                
                filter1[fieldName] = {$exists: false};
                filter2[fieldName] = null;
                // this = the mongoose model
                this.find({
                    $or: [
                        filter1,
                        filter2
                    ]
                }).exec().then((docs)=>{

                    var numSaved = docs.length;
                    syncEach(docs,(doc,cb)=>{
                        doc.__allowChange = true;//so the pre check wont fail because its not new and its changed.
                        getNextSeqObservable(doc.db.db,obj.collection)
                        .retryWhen(err => {
                            return err;
                        })
                        .subscribe(seq => {
                            doc[fieldName] = seq;
                            doc.save(function(){
                                cb();
                            })
                        });
                    },()=>{
                        resolve(numSaved);
                    });
                }).catch((err)=>reject(err));

            });
        });
    };

};

/*
ready()

It is necessary to wait until the connection is ready before 
allowing getNextSeqObservable to be called. else a stackoverflow occurs.
*/
function ready(){
    return new Promise((resolve,reject)=>{
        var _int = setInterval(()=>{
            if(mongoose.connection.readyState == 1){
                clearInterval(_int);
                resolve();
            }
        },200);
    })
}

/*
syncEach()

simple synchronous iterator. used by heal to iterate the documents that must be updated. 
done synchronously to avoid to much contention

*/
function syncEach( items, eachFn, callbackFn ){
    console.log('syncEach')
    items = items.concat([]);//prevent mutating the passed array.
    var results = [], 
        errors = [];
        
    var next = function (error,result){
        if(error != null) {
            errors.push(error);
        }
        if(result != undefined) {
            results.push(result);
        }
        if(items.length == 0){
            return callbackFn(errors,results);
        }else{
            //pop first item, pass it to eachCb with the next function
            eachFn(items.shift(),next);
        }
    };
    
    eachFn(items.shift(),next);
};

/*
getNextSeqObservable()

taken pretty much verbatim from here https://github.com/moltak/mongoose-autoincrement
*/
function getNextSeqObservable(db, name) {
    return rx.Observable.create(observable => {
        db.collection(countersCollection).findOneAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { returnOriginal: false, upsert: true },
        function (err, ret) {
            if (err) {
                return observable.onError(err);
            } else {
                observable.onNext(ret.value.seq);
                return observable.completed();
            }
        });
    });
};

//allow user to change the name of counters collection
autoIncrement.setCollection = function( collection ){
    countersCollection = collection;
};

module.exports = autoIncrement;