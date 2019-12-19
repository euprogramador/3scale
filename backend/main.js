// ignore ssl 
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var express = require('express');
var app = express();
var axios = require('axios');
const qs = require('query-string')

var bodyParser = require('body-parser');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// database
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('db.json')
const db = low(adapter)

db.defaults({ tenants: [], "access-control": [] })
    .write();


app.get('/', function (req, res) {
    res.send('3scale manager');
})

// list all tenants
app.get('/tenants', (req, res) => {
    db.read();
    res.send(db.get('tenants').value());
});

// list all tenants
app.delete('/tenants/:tenantId', (req, res) => {

    db.read();
    db.get('tenants').remove({ id: req.params.tenantId }).write();

    res.send();
});


// insert/update tenants
app.put("/tenants", (req, res) => {
    db.read();

    let tenant = db.get('tenants')
        .find({ id: req.body.id })
        .value();

    if (tenant == undefined) {

        db.get('tenants')
            .push(req.body)
            .write();

    } else {

        db.get('tenants')
            .find({ id: req.body.id })
            .assign(req.body)
            .write();

    }

    res.send(req.body);
});

// endpoint que se conecta ao 3scale para buscar as apis do tenant
app.get("/tenants/:tenantId/apis", (req, res) => {

    let tenant = db.get('tenants')
        .find({ id: req.params.tenantId })
        .value();

    axios.get(`${tenant.url}/admin/api/services.json`)
        .then((tenantResponse) => {
            let apis = [];
            res.send(tenantResponse.data.services.map(api => {
                return { id: api.service.system_name, name: api.service.name };
            }));
        }).catch((error) => {
            res.status(500).send('não foi possivel obter dados da api');
            console.error(error);
        })



});


app.get("/tenants/:tenantId/access-control", (req, res) => {
    db.read();
    // busca o controle de acesso para cada app e api
    let accessControl = db.get('access-control')
        .find({ tenant: req.params.tenantId })
        .value();

    if (accessControl == undefined)
        accessControl = { tenant: req.params.tenantId, "access-control": [] };

    res.send(accessControl);
});

// accounts do tenant
app.get("/tenants/:tenantId/accounts", (req, res) => {

    let tenant = db.get('tenants')
        .find({ id: req.params.tenantId })
        .value();

    axios.get(`${tenant.url}/admin/api/accounts.json`)
        .then((tenantResponse) => {
            let accounts = [];
            res.send(tenantResponse.data.accounts.map(obj => {
                return { id: obj.account.id, name: obj.account.org_name };
            }));
        }).catch((error) => {
            res.status(500).send('não foi possivel obter contas');
            console.error(error);
        })



});



sync = async (req, res) => {
    let tenant = db.get('tenants')
        .find({ id: req.params.tenantId })
        .value();

    // obtem as apis
    let apis = {};
    try {
        let tenantResponse = await axios.get(`${tenant.url}/admin/api/services.json`)
        tenantResponse.data.services.map(api => {
            let _api = { id: api.service.system_name, _internalId: api.service.id, name: api.service.name };
            apis[_api.id] = _api;
            return _api;
        });
    } catch (error) {
        res.status(500).send('não foi possivel obter dados da api');
        console.error(error);
    }

    // busca os planos default de cada api
    try {
        for (const _api of Object.keys(apis)) {

            let api = apis[_api];

            try {
                let response = await axios.get(`${tenant.url}/admin/api/services/${api._internalId}/application_plans.json`)

                let defaultPlan = response.data.plans.filter((plan) => plan.application_plan.default)[0];
                api.defaultPlan = defaultPlan.application_plan.id;
            } catch (error) {
                res.status(500).send('não foi possivel obter dados da api');
                console.error(error);
            }
        };

    } catch (err) {
        res.status(500).send('não foi possivel obter dados da api');
        console.error(error);
    }


    // cadastra novas apps



    let accessControl = db.get('access-control')
        .find({ tenant: req.params.tenantId }).value();

    for (const app of accessControl['access-control']) {

        // para cada aplicação percorre todas as apis 
        for (const _api of Object.keys(app.apis)) { ///.filter(_api => app.apis[_api])
            let api = apis[_api];

            if (api == undefined)
                continue;

            let response = null;

            try {
    
                try {
                    console.log({
                        user_key: app.applicationKey,
                        service_id: api._internalId
                    })

                    let urlFind = `${tenant.url}/admin/api/applications/find.json`;
                    // procura a aplicação no serviço para saber se já está cadastrado
                    let  responseFind = await axios.get(`${urlFind}?user_key=${app.applicationKey}&service_id=${api._internalId}`);
                    
                    try {
                        if (responseFind.status == 200 && !app.apis[_api]) {
                            console.log('removendo...')
                            // codigo para remover a app
                            let url = `${tenant.url}/admin/api/accounts/${tenant.account}/applications/${responseFind.data.application.id}.json`;
                            response = await axios.delete(url, qs.stringify({
                                account_id: tenant.account,
                                id: responseFind.data.application.id
                            }));
                            console.log('removido', app.applicationName, api.name)

                        } else if (responseFind.status == 200 && app.apis[_api]) {
                            console.log('atualizando...')
                            // update
                            let url = `${tenant.url}/admin/api/accounts/${tenant.account}/applications/${responseFind.data.application.id}.json`;
                            response = await axios.put(url, qs.stringify({
                                account_id: tenant.account,
                                name: app.applicationName,
                                description: app.applicationName
                            }));

                            console.log('atualizado', app.applicationName, api.name)
                        }
                    } catch (error) { console.log('erro ao atualizar ou remover')}
                    
                } catch (e) {
                  
                    if (e.response.status == 404 && app.apis[_api]) {
                        console.log('cadastrando...')
                        // cadastra a app 
                        let url = `${tenant.url}/admin/api/accounts/${tenant.account}/applications.json`;
                        response = await axios.post(url, qs.stringify({
                            plan_id: api.defaultPlan,
                            name: app.applicationName,
                            description: app.applicationName,
                            user_key: app.applicationKey,
                            application_id: app.applicationKey,
                            application_key: app.applicationKey
                        }));

                        console.log('cadastrado', app.applicationKey,api.name)

                    } else {
                        console.log('não faz nada', app.applicationName, api.name)
                    }

                }

            } catch (error) {
                res.status(500).send('não foi possivel obter dados da api');
                console.error(error);
            }
        };
    };


}

// atualiza o controle de acesso da api
app.put("/tenants/:tenantId/access-control", async (req, res) => {
    db.read();

    let accessControl = db.get('access-control')
        .find({ tenant: req.params.tenantId });

    if (accessControl.value() == undefined) {
        db.get('access-control').push(req.body).write();
    } else {

        accessControl.assign(req.body).write();
    }
    try {
        await sync(req, res);

        res.send(req.body);
    } catch (e) {
        res.status(500).send('não foi possivel obter dados da api');
        console.error(e);
    }
});

var server = app.listen(8081, function () {
    var host = server.address().address
    var port = server.address().port

    console.log("Example app listening at http://%s:%s", host, port)
})