require('dotenv').config();
const { getCarData } = require("./services/carDataService");

const testCars = [
  { brand: "Toyota", model: "Corolla", year: "2020" },
  { brand: "Ford", model: "Fiesta", year: "2019" },
  { brand: "Volkswagen", model: "Golf", year: "2021" },
  { brand: "BMW", model: "3 Series", year: "2020" },
  { brand: "Audi", model: "A4", year: "2021" },
  { brand: "Mercedes", model: "C-Class", year: "2020" }
];

async function testAllCars() {
  for (const car of testCars) {
    const data = await getCarData(car);
    console.log(`\n=== ${car.brand} ${car.model} ${car.year} ===`);
    console.log(JSON.stringify(data, null, 2));
  }
}

testAllCars();
