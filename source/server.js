const express = require("express")
const server = express()
var session = require('express-session')

const basePath = __dirname + "/views"

const sqlite3 = require('sqlite3').verbose()
const sqlite =  require('sqlite')
const { json } = require("express/lib/response")
const { NEWDATE } = require("mysql/lib/protocol/constants/types")

server.use(session( {secret: 'keyboard cat', resave: false, saveUninitialized: true} ))

server.set('view engine', 'ejs')
server.use(express.static("public"))
server.use(express.json())
server.use(express.urlencoded({ extended: true }))

let db = new sqlite3.Database('./database.db', async (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Banco de dados conectado.');
});

function loadProperties() {
    return new Promise((resolve, reject) => {
        
        db.all('SELECT * from properties', (err, row) => {
            if (err) {

                return reject(err);

            } else {

                resolve(row)
            }
        });

    });
}

function loadHouses() {
    return new Promise((resolve, reject) => {
        
        db.all('SELECT * from houses', (err, row) => {
            if (err) {

                return reject(err);

            } else {

                resolve(row)
            }
        });

    });
}

function loadTransactions(player) {
    return new Promise((resolve, reject) => {

        db.all('SELECT * FROM bank WHERE usuario = ? ORDER BY id_transacao DESC LIMIT 15', [player], (err, row) => {
            if (err) {

                return reject(err);

            } else {

                resolve(row)
            }
        });

    });
}

function loadRanking() {
    return new Promise((resolve, reject) => {

        db.all('SELECT nickname, experience, money FROM players ORDER BY experience DESC LIMIT 50', (err, row) => {
            if (err) {

                return reject(err);

            } else {

                resolve(row)
            }
        });

    });
}

server.get('/', (req, res) => {

    req.session.login = true;
    playerName = 'Henrique'
    lastLoginDate = '14/09/1995'
    lastLoginHour = '18:00'
    playerMoney = 9000
    playerExperience = 500
    playerHouse = 'Nenhum'
    playerPropertie = 'Nenhum'

    if(req.session.login){
        res.render(basePath + "/dashboard", { playerName, lastLoginDate, lastLoginHour, playerMoney, playerExperience, playerHouse, playerPropertie } )
    }  
    
    else{
        res.render(basePath + '/index')
    }
    
})

server.post('/', async (req, res) => {

    if(req.body.nickname && req.body.password)
    {
        //Adicionar password com case sensitive aqui
        const result = await db.get('SELECT nickname FROM players WHERE nickname = ? AND password = ?', [req.body.nickname, req.body.password], (error, row, fields) => {

            if (error) throw error;

            if(typeof row === 'object'){

                req.session.login = true
			    req.session.nickname = row.nickname
                res.render(basePath + '/dashboard')

            }
             
            else{

                res.render(basePath + '/index', { loginError: true } )

            } 

            res.end();

        })

    }

})

server.get('/register', (req, res) => {

    if(req.session.login){
        res.render(basePath + "/dashboard")
    }  
    
    else{
        res.render(basePath + '/register')
    }
    
})

server.post('/register', async (req, res) => {

    let nickname = req.body.registerNickname;
	let password = req.body.registerPassword;
    let email = req.body.registerEmail;

    if(nickname && password && email)
    {

        await db.get('SELECT nickname FROM players WHERE nickname = ? COLLATE NOCASE', [nickname], (error, row, fields) => {

            if (error) throw error;

            if(typeof row!= 'undefined' ){

                res.render(basePath + '/register', { registerError: true , messageError: 'Esse nick já foi escolhido por outro usuário' } )


            }
        })

        db.get('SELECT email FROM players WHERE email = ? COLLATE NOCASE', [email], (error, row, fields) => {

            if (error) throw error;

            if(typeof row!= 'undefined') {

                res.render(basePath + '/register', { registerError: true , messageError: 'Esse email já foi escolhido por outro usuário' } )

            }
        })

        db.run('INSERT INTO players (nickname, password, email, money, experience, house, property, admin, avatar, lastLoginDate, lastLoginHour) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nickname, password, email, 0, 0, 0, 0, 0, 0, dateLogin, 0], (error, row, fields) => {

            if(error){
                console.log(error)
                res.render(basePath + '/register')
                return
            }

            req.session.login = true
			req.session.nickname = nickname
            res.render(basePath + '/dashboard')

        })
        

    }

})

server.get('/houses', async (req, res) => {

    if(req.session.login){

        const result = await loadHouses();

        res.render(basePath + "/houses", { data: result, msgModal: null} )

    }  
    
    else{
        res.render(basePath + '/index')
    }
    
})

server.post('/houses', async (req, res) => {

    const result = await loadHouses();

    console.table(req.body)

    if(req.body.houseValue && req.body.houseName){

        if(playerMoney >= req.body.houseValue){

            playerMoney -= req.body.houseValue
            playerHouse = req.body.houseName

            var today = new Date();
            var date = today.getDate() + '-' + (today.getMonth()+1) + '-' + today.getFullYear();
            var hour = today.getHours() + ':' + today.getMinutes();

            db.run('UPDATE players SET house = ?, money = ? WHERE nickname = ?', [playerHouse, playerMoney, playerName], (error, row) => {

                if(error){

                    console.log(error)
                    return false

                }
        
            })

            db.run('INSERT INTO bank (usuario, transacao, valor, data) VALUES (?, ?, ?, ?)', [playerName, "Entrada de Imóvel: " + req.body.houseName, req.body.houseValue, date + " as " + hour], (error, row) => {

                if(error){

                    console.log(error)
                    return false

                }
        
            })

            res.render(basePath + "/houses", { data: result} )
        }

        else{

            res.render(basePath + '/houses', { data: result } )

        }
    }

    res.end();

})

server.get('/properties', async (req, res) => {

    if(req.session.login){

        const result = await loadProperties();

        res.render(basePath + "/properties", { data: result, msgInfo: undefined } )

    }  
    
    else{
        res.render(basePath + '/index')
    }  

})

server.post('/properties', async (req, res) => {

    const result = await loadProperties();

    console.table(req.body)

    /*

    If(Já tem casa ) == OpenModal (Erro)

    */

    if(req.body.propertieValue && req.body.propertieName){

        if(playerMoney >= req.body.propertieValue){

            playerMoney -= req.body.propertieValue
            playerPropertie = req.body.propertieName
            //Salvar SQL casa do player
            //Salvar em transações do player

            res.render(basePath + "/properties", { data: result , msgInfo: 'Parabéns você adquiriu a propriedade' + playerPropertie } )

        }

        else{
            res.render(basePath + "/properties", { data: result, msgInfo: 'Você não tem dinheiro o suficiente para adquirir essa propriedade' } )
        }
    }

    res.end();

})

server.get('/bank', async (req, res) => {

    if(req.session.login){

        const result = await loadTransactions(playerName);

        res.render(basePath + "/bank", { data: result} )

    }  
    
    else{
        res.render(basePath + '/index')
    }
    
})

server.get('/ranking', async (req, res) => {

    if(req.session.login){

        const result = await loadRanking();

        res.render(basePath + "/ranking", { data: result} )

    }  
    
    else{
        res.render(basePath + '/index')
    }
    
})

server.get('/profile', async (req, res) => {

    if(req.session.login){

        res.render(basePath + "/profile")

    }  
    
    else{
        res.render(basePath + '/index')
    }
    
})

//Checar se o player já tem empresa e retornar mensagem de erro

server.listen(3000)