let cars = JSON.parse(localStorage.getItem("cars")) || [];

const form = document.getElementById("carForm");
const carList = document.getElementById("carList");

function saveToStorage() {
  localStorage.setItem("cars", JSON.stringify(cars));
}

function displayCars() {
  carList.innerHTML = "";

  cars.forEach((car, index) => {
    carList.innerHTML += `
      <tr>
        <td>${car.marque}</td>
        <td>${car.modele}</td>
        <td>${car.annee}</td>
        <td class="actions">
          <button class="edit" onclick="editCar(${index})">✏️</button>
          <button class="delete" onclick="deleteCar(${index})">❌</button>
        </td>
      </tr>
    `;
  });
}

form.addEventListener("submit", function(e) {
  e.preventDefault();

  const id = document.getElementById("carId").value;
  const marque = document.getElementById("marque").value;
  const modele = document.getElementById("modele").value;
  const annee = document.getElementById("annee").value;

  const car = { marque, modele, annee };

  if (id === "") {
    cars.push(car);
  } else {
    cars[id] = car;
  }

  saveToStorage();
  displayCars();
  form.reset();
  document.getElementById("carId").value = "";
});

function editCar(index) {
  const car = cars[index];
  document.getElementById("carId").value = index;
  document.getElementById("marque").value = car.marque;
  document.getElementById("modele").value = car.modele;
  document.getElementById("annee").value = car.annee;
}

function deleteCar(index) {
  if (confirm("Supprimer cette voiture ?")) {
    cars.splice(index, 1);
    saveToStorage();
    displayCars();
  }
}

displayCars();