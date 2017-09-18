// MIT LICENSE
// based on https://github.com/moltak/mongoose-autoincrement


const rx = require('rx');
const mongoose = require('mongoose');

var countersCollection = 'counters';//the name of the collection used to store id counters.

function autoIncrement(schema, options) {

    var fieldName = options.field || '_id';

    var definition = {
        [fieldName]:{
            type: Number,
            // unique: true,
            // sparse: true,
            // partialFilterExpression: {
            //     [fieldName]:{
            //         $type: 'number',
            //         $exists: true
            //     }
            // }//thus no non numeric index errors!
        }
    };

    console.log(definition);
    
    // add the field to model.
    schema.add(definition);

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
                console.log('ready()');
        
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
                    console.log(docs);
                    var numSaved = docs.length;
                    syncEach(docs,(doc,cb)=>{
                        doc.__allowChange = true;//so the pre check wont fail because its not new and its changed.
                        getNextSeqObservable(doc.db.db,doc.collection.name)
                        .retryWhen(err => {
                            console.log(err)
                            return err;
                        })
                        .subscribe(seq => {
                            console.log('got seq %d',seq)
                            doc[fieldName] = seq;
                            doc.save(function(err){
                                console.log(err)
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