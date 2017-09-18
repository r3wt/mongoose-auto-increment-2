const mongoose = require('mongoose');
const autoincrement = require('./index');

mongoose.Promise = Promise;
mongoose.connect('mongodb://localhost/mongoose-test',{ useMongoClient: true });


var PersonSchema = new mongoose.Schema({
    name: { type: String }
});

PersonSchema.plugin(autoincrement,{ field: 'id' });

var Person = mongoose.model('Person',PersonSchema);

mongoose.connection.on('connected', function () {  
    console.log('Mongoose connected.');

    var a = new Person({
        name: 'Foo'
    });

    a.save(function(){
        console.log(a.id);
    });

}); 

// If the connection throws an error
mongoose.connection.on('error',function (err) { 
    options.log('`mongoose error:'+"\r\n"+err.toString());
}); 

// When the connection is disconnected
mongoose.connection.on('disconnected', function () {  
    console.log('mongoose disconnect');
});

// hangs if done before connection.
// investigate why before releasing module

var b = new Person({
    name: 'Bar'
});

b.save(function(){
    console.log(b.id);

    //now test delete id and heal
    b.__allowChange = true;
    b.id = null;
    b.save(function(err,b2){
        console.log(err);
        console.log(b2.id);
        if(!err){
            Person.heal().then(function(num){
                console.log('healed %d people',num);

                //finally test delete id without override. should trigger error
                Person.findOne({ _id: b2._id },(err,b3)=>{
                    console.log(b3.id);
                    b3.id = null;
                    b3.save(function(err,doc,numAffected){
                        console.log(err);//should error
                        console.log(doc);
                        console.log(numAffected);
                    })
                });

            });
        }
    });
});

