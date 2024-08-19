document.addEventListener("DOMContentLoaded", async () => {
    try{
        const response = await fetch("api/plays");
        const data = await response.json();

        const averages = calculateAverages(data);
        displayAverages(averages);
    } catch (error) {
        console.log(error);
    }
});


