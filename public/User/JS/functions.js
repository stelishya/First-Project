window.onload =function(){
    const time_display=document.getElementById('timer')
    const resend_button=document.getElementById('resend_button');
}   

    if(time_display && resend_button){
        let time_left=30;

        const timer=setInterval(()=>{
            if(time_left <= 0){
                clearInterval(timer);
                resend_button.disabled=false;
                time_display.textContent='0';
            }else{
                time_display.textContent=time_left;
            }
            time_left --;

        },1000)
    }