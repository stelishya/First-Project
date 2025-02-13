console.log("categories.js is working")

    async function handleFormSubmit(event){
        event.preventDefault();

        // Validate form inputs
        if(!validateForm()){
            return;
        }
        // Get form values
        const name = document.getElementsByName('name')[0].value.trim();
        const description = document.getElementById("descriptionId").value.trim();
        try{
            // Send POST request using Axios
            const response =await axios.post('/admin/addCategory',{name,description});
            // On success, show success message and reload
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Category added successfully!',
            }).then(() => {
                location.reload(); // Reload the page on success
            });
        } catch (error) {
            // Handle errors
            console.log("Error adding category:", error);
            if (error.response && error.response.data.message === 'Category already exists') {
                Swal.fire({
                    icon: 'error',
                    title: "Oops",
                    text: "Category already exists",
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: "Oops",
                    text: "An error occurred while adding the category",
                });
            }
        }
    }

        
        // fetch('admin/addCategory',{
        //     method:'POST',
        //     headers:{
        //         'content-type':'application/json'
        //     },
        //     body:JSON.stringify({name,description})
        // })
        // .then(response=>{
        //     if(!response.ok){
        //         return response.json().then(err=>{
        //             throw new Error(err.error);
        //         })
        //     }
        //     return response.json();
        // })
        // .then(data=>{
        //     location.reload();
        // })
        // .catch(error=>{
        //     if(error.message === 'Category already exists'){
        //         Swal.fire({
        //             icon:'error',
        //             title:"Oops",
        //             text:"Category already exists"
        //         })
        //     }else{
        //         Swal.fire({
        //             icon:'error',
        //             title:"Oops",
        //             text:"An error occured while adding the category"
        //         })
        //     }
        // })
    
     function validateForm(){
        console.log("validateForm called")
        clearErrorMessages();
        const name= document.getElementsByName('name')[0].value.trim();
        const description = document.getElementById('descriptionId').value.trim();
        isValid= true;

        // Validate name field
        if(name === ""){
            displayErrorMessage("name-error","Please enter a name");
            isValid = false;
        }else if(!/^[a-zA-Z\s]+$/.test(name)){
            displayErrorMessage("name-error","Category name should contain only alphabetic characters  ")
            isValid = false;
        }
        // Validate description field
        if(description === ""){
            displayErrorMessage("description-error","Please enter a description");
            isValid = false;
        }else if (!/^[a-zA-Z\s]+$/.test(description)){
            displayErrorMessage("description-error","Description should contain only alphabetic characters");
            isValid = false;
        }
        return isValid;
     }  

     function displayErrorMessage(elementId,message){
        const errorElement = document.getElementById(elementId);
        errorElement.innerText = message;
        errorElement.style.display = "block";
     }

     function clearErrorMessages(){
        const errorElements = document.getElementsByClassName("error-message");
        Array.from(errorElements).forEach((element)=>{
            element.innerText = "";
            element.style.display = "none";
        })
     }
async function addOffer(categoryId,event) {
    console.log("Add Offer function called for categoryId:", categoryId);

    event.preventDefault();

    const { value: amount } = await Swal.fire({
        title: 'Offer in percentage',
        input: 'number',
        inputLabel: 'Percentage',
        inputPlaceholder: '%',
    });

    if (amount) {
        try {
            const response = await axios.post('/admin/addCategoryOffer', {
                percentage:amount,
                categoryId:categoryId,
            });

            // const data = await response.json();
            // if(response.ok && data.status === true){
           
            if(response.status === 200 && response.data.status === true){
                Swal.fire(
                    "Offer added",
                    "The offer has been added successfully",
                    "success"
                ).then(() => {
                    location.reload();
                });
            }else {
                Swal.fire(
                    "Failed", 
                    response.data.message || "Adding offer failed",
                    "error"
                );
            }
        } catch (error) {
            Swal.fire(
                "Error",
                "An error occured while adding the offer",
                "error"
            );
            console.log("Error adding offer",error);
        }
    }
}

async function removeOffer(categoryId) {
    try {
        const response = await axios.post("/admin/removeCategoryOffer", {
            categoryId: categoryId,
        });

        // const data = await response.json();
        // if (response.ok && data.status === true) {

        if (response.status === 200 && response.data.status === true) {
            Swal.fire(
                "Offer removed",
                "The offer has been removed",
                "success"
            ).then(()=>{
                location.reload();
            });
        } else {
            Swal.fire("Failed",
                response.data.message || "Removing offer failed",
                "error"
            );
            console.error("Failed to remove offer");
        }
    } catch (error) {
        Swal.fire(
            "Error",
            "An error occured while removing the offer",
            "error"
        )
        console.error("Error removing offer:", error);
    }
}

  