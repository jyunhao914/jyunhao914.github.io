// Return physical dimensions in the gallery's world unit (one metre).
export function readDimensions(names) {
  const dialog=document.createElement("dialog");
  dialog.setAttribute("aria-label","輸入原作尺寸");
  dialog.style.cssText="width:min(30rem,90vw);height:auto;max-height:85dvh;overflow:auto";
  const form=document.createElement("form");
  form.innerHTML='<h2>輸入原作尺寸</h2><p>請填畫心的實際寬高，裝裱另計。</p><label>尺寸單位<select name="unit"><option value="100">公分</option><option value="1">公尺</option><option value="1000">毫米</option></select></label>';
  const rows=names.map(name=>{
    const row=document.createElement("fieldset");
    row.innerHTML='<legend></legend><label>寬<input name="w" type="number" step="any" required></label><label>高<input name="h" type="number" step="any" required></label>';
    row.querySelector("legend").textContent=name;
    form.append(row);
    return row;
  });
  const unit=form.elements.unit;
  function bounds(){
    for(const row of rows) for(const input of row.querySelectorAll("input")){
      input.min=.05*Number(unit.value);
      input.max=(input.name==="w"?100:4.4)*Number(unit.value);
    }
  }
  bounds();
  unit.onchange=bounds;
  const cancel=document.createElement("button"),submit=document.createElement("button");
  cancel.type="button";cancel.textContent="取消";cancel.onclick=()=>dialog.close();
  submit.type="submit";submit.textContent="確認尺寸";
  form.append(cancel,submit);dialog.append(form);document.body.append(dialog);
  return new Promise(resolve=>{
    let result=null;
    form.onsubmit=e=>{
      e.preventDefault();
      result=rows.map(row=>({width:row.querySelector('[name=w]').valueAsNumber/Number(unit.value),
        height:row.querySelector('[name=h]').valueAsNumber/Number(unit.value)}));
      dialog.close();
    };
    dialog.onclose=()=>{dialog.remove();resolve(result)};
    dialog.showModal();
  });
}
