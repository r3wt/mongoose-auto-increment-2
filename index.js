// MIT LICENSE
// based on https://github.com/moltak/mongoose-autoincrement

const rx = require('rx');
var mongoose = require('mongoose');

var forceReady = false;
var countersCollection = 'counters';//the name of the collection used to store id counters.

function autoIncrement(schema, options) {

    var fieldName = options.field || '_id';

    // add the field to model.
    schema.add({
        [fieldName]:{
            type: Number,
        }
    });

    schema.index({ [fieldName]: 1 },{
        partialFilterExpression: {
            [fieldName]:{
                $type: 'number',
                $exists: true
            }
        },
        unique: true
    });

    schema.pre('save', function (next) {

        var doc = this;

        ready().then(()=>{

            if (doc.db && doc.isNew && typeof doc[fieldName] === 'undefined') {
                getNextSeqObservable(doc.db.db, doc.collection.name)
                .retryWhen(err => {
                    console.log(err);
                    return err;
                })
                .subscribe(seq => {
                    doc[fieldName] = seq;
                    next();
                });
            } else {
                //heal sets doc.__allowChange to true in order to bypass this check.
                if(!doc.__allowChange){
                    if(doc.isModified(fieldName)){
                        doc.invalidate(fieldName,'You may not modify the auto-increment field `'+fieldName+'` ');
                        // doc.$ignore(fieldName);
                    }
                }else{
                    delete doc.__allowChange;
                }
                next();
            }

        });
    });

    schema.statics.heal = function(){
        return new Promise((resolve,reject)=>{
            ready().then(()=>{
                // this = the mongoose model
                this.find({
                    $or: [
                        { [fieldName] : { $exists: false } },
                        { [fieldName] : null }
                    ]
                }).exec().then((docs)=>{
                    var numSaved = docs.length;
                    syncEach(docs,(doc,cb)=>{
                        doc.__allowChange = true;//so the pre check wont fail because its not new and its changed.
                        getNextSeqObservable(doc.db.db,doc.collection.name)
                        .retryWhen(err => {
                            console.log(err)
                            return err;
                        })
                        .subscribe(seq => {
                            doc[fieldName] = seq;
                            doc.save(function(err){
                                console.log(err)
                                cb();
                            });
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
            if(mongoose.connection.readyState == 1 || forceReady){
                clearInterval(_int);
                resolve();
            }
        },200);
    })
}

/*
syncEach()

simple synchronous iterator. used by heal to iterate the documents that must be updated.
done synchronously to avoid too much contention

*/
function syncEach( items, eachFn, callbackFn ){
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

//force ready() if heal() isnt working
autoIncrement.ready = function(){
    forceReady = true;
};

module.exports = autoIncrement;
