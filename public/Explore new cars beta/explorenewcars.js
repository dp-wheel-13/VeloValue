async function fetchCarsFromAPI() {
    try {
        const response = await fetch('/api/cars'); // Your backend endpoint
        const cars = await response.json();
        return cars;
    } catch (err) {
        console.error('Error fetching cars:', err);
        return [];
    }
}
async function populateCarSpecs(car) {
    const wikiData = await fetch(`/api/wiki-car?brand=${car.brand}&model=${car.model}`)
        .then(res => res.json())
        .catch(() => ({}));

    return {
        brand: car.brand || wikiData.brand || 'Not available',
        model: car.model || wikiData.model || 'Not available',
        year: car.year || wikiData.year || 'Not available',
        fuel: car.fuel || wikiData.fuel || 'Not available',
        transmission: car.transmission || wikiData.transmission || 'Not available',
        driveType: car.driveType || wikiData.driveType || 'Not available',
        zeroToHundred: car.zeroToHundred || wikiData.zeroToHundred || 'Not available',
        topSpeed: car.topSpeed || wikiData.topSpeed || 'Not available',
        horsepower: car.horsepower || wikiData.horsepower || 'Not available',
        torque: car.torque || wikiData.torque || 'Not available',
        weight: car.weight || wikiData.weight || 'Not available',
        price: car.price || wikiData.price || 'Not available',
        colors: car.colors || wikiData.colors || ['Not available'],
        dimensions: car.dimensions || wikiData.dimensions || 'Not available',
        cargoCapacity: car.cargoCapacity || wikiData.cargoCapacity || 'Not available',
        seatingCapacity: car.seatingCapacity || wikiData.seatingCapacity || 'Not available',
        emissions: car.emissions || wikiData.emissions || 'Not available',
        image: wikiData.image || 'No image found',
        logo: wikiData.logo || 'No logo found',
        safetyRating: car.safetyRating || wikiData.safetyRating || 'Not available'
    };
}
function createCarCard(car) {
    return `
        <div class="car-card" data-brand="${car.brand}" data-model="${car.model}">
            <img src="${car.image}" alt="${car.brand} ${car.model}">
            <h3>${car.brand} ${car.model}</h3>
            <p>Price: ${car.price}</p>
            <p>Fuel: ${car.fuel}</p>
        </div>
    `;
}
async function populateExplorePage() {
    const container = document.getElementById('car-cards-container');
    const cars = await fetchCarsFromAPI();

    for (const car of cars) {
        const fullCarData = await populateCarSpecs(car);
        const cardHTML = createCarCard(fullCarData);
        container.innerHTML += cardHTML;
    }
}

populateExplorePage();
document.addEventListener('click', e => {
    const card = e.target.closest('.car-card');
    if(card) {
        const brand = card.dataset.brand;
        const model = card.dataset.model;
        window.location.href = `/car-details.html?brand=${brand}&model=${model}`;
    }
});
