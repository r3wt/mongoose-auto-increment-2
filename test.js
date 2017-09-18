const mongoose = require('mongoose');
const autoincrement = require('./index');

mongoose.Promise = Promise;
mongoose.connect('mongodb://localhost/mongoose-test',{ useMongoClient: true });

mongoose.connection.on('connected', function () {  
    console.log('Mongoose connected.');
    var PersonSchema = new mongoose.Schema({
        name: { type: String }
    });

    PersonSchema.plugin(autoincrement,{ field: 'id' });

    var Person = mongoose.model('Person',PersonSchema);

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

// var PersonSchema = new mongoose.Schema({
//     name: { type: String }
// });

// PersonSchema.plugin(autoincrement,{ field: 'id' });

// var Person = mongoose.model('Person',PersonSchema);

// var a = new Person({
//     name: 'Foo'
// });

// a.save(function(){
//     console.log(a.id);
// });

