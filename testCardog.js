require('dotenv').config();
const axios = require('axios');

const CARDOG_API_KEY = process.env.CARDOG_API_KEY;
const BASE_URL = 'https://api.cardog.io/v1'; // adjust if Cardog docs specify a different base URL

async function testCardogAPI() {
    try {
        console.log('Fetching brands...');
        const brandsRes = await axios.get(`${BASE_URL}/brands`, {
            headers: {
                'Authorization': `Bearer ${CARDOG_API_KEY}`
            }
        });
        const brands = brandsRes.data;
        console.log('Brands available:', brands.length, brands.map(b => b.name));

        if (!brands.length) return;

        const brand = brands[0].name;
        console.log(`\nFetching models for brand: ${brand}...`);
        const modelsRes = await axios.get(`${BASE_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${CARDOG_API_KEY}`
            },
            params: { brand }
        });
        const models = modelsRes.data;
        console.log('Models available:', models.length, models.map(m => m.name));

        if (!models.length) return;

        const model = models[0].name;
        const year = models[0].year || 2022; // pick a default year if not provided
        console.log(`\nFetching details for ${brand} ${model} (${year})...`);
        const detailsRes = await axios.get(`${BASE_URL}/model-details`, {
            headers: {
                'Authorization': `Bearer ${CARDOG_API_KEY}`
            },
            params: { brand, model, year }
        });

        console.log('\n=== Model Details ===');
        console.log(JSON.stringify(detailsRes.data, null, 2));

    } catch (error) {
        console.error('❌ Cardog API error:', error.response?.data || error.message);
    }
}

testCardogAPI();
