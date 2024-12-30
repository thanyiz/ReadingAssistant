"use strict";

GM_addStyle(`
  #floating-chat {
    border-radius: 10px; 
    position: fixed; 
    bottom: 15px; 
    right: 20px; 
    width: 620px; 
    border: 1px solid #ccc; 
    padding: 5px; 
    overflow-y: auto; 
    height: 870px; 
    cursor: default; 
    display: flex; 
    flex-direction: column; 
    background-color: rgba(248, 248, 248, 0.95); 
    z-index: 999;
  }

  #recommendation {
    overflow-x: hidden;
    overflow-y: hidden;
    display: flex;
    flex-direction: row; 
    margin-bottom: 3px;
    max-width: 100%;
  }

  .recButton {
    white-space: nowrap;
    border-radius: 8px;
    margin: 0px 5px 6px 5px;
    padding: 6px;
    background-color: white; 
    border: 1px solid #687EFF;
  }

  .recButton:hover {
    white-space: nowrap;
    border-radius: 8px;
    margin: 0px 5px 6px 5px;
    padding: 6px;
    border: 1px solid #687EFF;
    background-color: #F5F5F5; 
  }
  
  #chat-container {
    flex: 1; 
    overflow-y: auto; 
    display: block; 
  }

  #bottom-bar {
    display: flex; 
    flex-direction: column; 
    align-items: flex-start; 
    margin-top: 5px; 
    padding: 0px 7px 2px 7px;
  }

  #message-input {
    border-radius: 10px; 
    width: 100%; 
    padding: 8px; 
    margin-bottom: 5px; 
    flex: 2;
  }

  #message-input:focus {
    border-radius: 10px; 
    width: 100%; 
    padding: 8px; 
    margin-bottom: 8px; 
    flex: 2;
  }


  #button-bar {
    display: flex; 
    align-items: center; 
    width: 100%; 
    gap: 10px; 
    padding: 5px;
    flex: 1;
  }

  #send-button, #clear-button,#text2voice,#talk,#t2p {
    height: 100%; 
    flex: 2; 
    padding: 5px; 
    border-radius: 8px;
    background-color: white; 
    color: white; 
    border: none;
    cursor: pointer; 
    margin-right: 0px;
    box-shadow: 3px 3px 6px #CCCCCC;
  }


  #send-button:hover, #clear-button:hover,#text2voice:hover,#talk:hover,#t2p:hover {
    height: 100%; 
    flex: 2; 
    padding: 5px; 
    border-radius: 8px;
    background-color: #F2F2F2; 
    color: white; 
    cursor: pointer; 
    margin-right: 0px;
    box-shadow: 3px 3px 6px #CCCCCC;
  }


  #speech {
    height: 100%; 
    flex: 22; 
    padding: 5px; 
    border-radius: 8px;
    background-color: white; 
    color: white; 
    border: 1px solid #222; /* 2像素宽的实线黑色边框 */
    border: none;
    cursor: pointer; 
    margin-right: 0px;
    box-shadow: 2px 2px 5px #CCCCCC;
  }


  #speech:hover {
    height: 100%; 
    flex: 22; 
    padding: 5px; 
    border-radius: 8px;
    background-color: #F2F2F2; 
    color: white; 
    border: 1px solid #222; /* 2像素宽的实线黑色边框 */
    border: none;
    cursor: pointer; 
    margin-right: 0px;
    box-shadow: 2px 2px 5px #CCCCCC;
  }

  .sendMessageSpan {
    display: inline-block;
    margin-left: auto;
    background-color: #87C4FF;
    color: black;
    top: 0;
    right: 0;
    max-width: 90%;
    padding: 9px;
    border-radius: 8px;
    white-space: pre-line;
    overflow-wrap: break-word;
    box-shadow: 2px 2px 5px #CCCCCC;
  }

  .receiveMessageSpan {
    display: inline-block;
    background-color: white;
    color: black;
    top: 0;
    right: 0;
    max-width: 90%;
    padding: 9px;
    border-radius: 8px;
    white-space: pre-line;
    overflow-wrap: break-word;
    box-shadow: 2px 2px 5px #CCCCCC;
  }

`);

let socket = io("服务器地址");
// 存放GPT回复的chunk
let currentContent = "";

let converter = new showdown.Converter();
let reference = new Set([]);
let ref_color = "#F2F1EB";
// 鼠标选中的引用文本
let ref_selected_text = "";
// 是否按下语音输入
let speech_btn_enable = false;
let mediaRecorder = null;
let chunks = [];
// 是否启用GPT语言回复
let enable_talk = false;

// 文章内容靠左
// document.querySelector(
//   "section > div > div:nth-child(2) > div"
// ).style.justifyContent = "left";

document.querySelectorAll("section > div > div").forEach((item) => {
  let part = item.querySelector("div");
  if (part) {
    part.style.justifyContent = "left";
  }
});

// 在指定标签后添加checkbox
function parse() {
  let root = "section > div > div > div > div > ";
  let p_filter = root + "p,";
  let h_filter = root + "h1," + root + "h2," + root + "h3," + root + "h4,";
  let code_filter = root + "pre,";
  let ul_filter = root + "ul,";
  let ol_filter = root + "ol,";
  let blockquote_filter = root + "blockquote";

  let passage = document.querySelector(
    "section > div > div > div > div"
  ).innerText;
  socket.emit("passage", passage);

  document
    .querySelectorAll(
      p_filter +
        h_filter +
        code_filter +
        ul_filter +
        ol_filter +
        blockquote_filter
    )
    .forEach(function (element) {
      let checkbox_ref = document.createElement("input");
      checkbox_ref.type = "checkbox";
      checkbox_ref.className = "checkbox_ref";

      let is_h = false;
      let contain_element = [];
      let h_num = undefined;
      let original_bg_color = element.style.backgroundColor;

      if (element.tagName.toLowerCase().startsWith("h")) {
        is_h = true;
        contain_element.push(element);
        h_num = Number(element.tagName[1]);
        let currentElement = element;
        while (currentElement.nextElementSibling) {
          let nextElementSibling = currentElement.nextElementSibling;
          if (
            nextElementSibling.tagName.toLowerCase().startsWith("h") &&
            Number(nextElementSibling.tagName[1]) <= h_num
          ) {
            contain_element.push(nextElementSibling);
            break;
          } else {
            contain_element.push(nextElementSibling);
            currentElement = nextElementSibling;
          }
        }
      }

      checkbox_ref.addEventListener("change", () => {
        if (is_h) {
          if (checkbox_ref.checked) {
            reference.add(element);
            contain_element.slice(1, -1).forEach((item) => {
              item.nextElementSibling.checked = true;
              // 通过js的方式改变checkbox的状态并不会触发checkbox的change事件, 需要手动写一个change event
              let changeEvent = new Event("change");
              item.nextElementSibling.dispatchEvent(changeEvent);
            });
            element.style.backgroundColor = ref_color;
          } else {
            contain_element.slice(1, -1).forEach((item) => {
              item.nextElementSibling.checked = false;
              let changeEvent = new Event("change");
              item.nextElementSibling.dispatchEvent(changeEvent);
            });
            reference.delete(element);
            element.style.backgroundColor = original_bg_color;
          }
        } else {
          if (checkbox_ref.checked) {
            reference.add(element);
            element.style.backgroundColor = ref_color;
          } else {
            reference.delete(element);
            element.style.backgroundColor = original_bg_color;
          }
        }
      });
      element.parentNode.insertBefore(checkbox_ref, element.nextSibling);
    });
}

// ctrl+enter发送
function checkCtrlEnter(event) {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    if (document.getElementById("message-input").value.trim() !== "") {
      document.getElementById("send-button").click();
    }
  }
}

// 主界面
function chatContainerFun() {
  let chatBoxHTML = `
        <div id="floating-chat">
            <div id="chat-container"></div>
            <div id="bottom-bar">
                <div id="recommendation"></div>
                <textarea type="text" id="message-input" rows='4' placeholder="Enter换行,Ctrl+Enter发送"></textarea>
                <div id="button-bar">
                    <button id="send-button" title="发送"><svg t="1705970258724" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2311" width="16" height="16"><path d="M1023.200312 43.682936L877.057399 920.640375c-1.899258 10.995705-8.096837 19.592347-18.292854 25.689965-5.29793 2.898868-11.295588 4.598204-17.693089 4.598204-4.19836 0-8.796564-0.99961-13.69465-2.898868l-236.707536-96.762202c-12.994924-5.29793-27.889106-1.499414-36.785631 9.296368l-123.251855 150.341273c-6.897306 8.796564-16.293635 13.094885-27.989066 13.094885-4.898087 0-9.096447-0.799688-12.695041-2.299102-7.197189-2.698946-12.994924-6.997267-17.393206-13.394768-4.398282-6.29754-6.697384-13.194846-6.697384-20.891839V811.083171c0-14.794221 5.098009-28.988676 14.394377-40.484186l478.912925-587.070676-602.864506 521.796174c-4.598204 3.898477-10.995705 4.998048-16.493557 2.698945L23.390863 619.358063C9.296369 614.060133 1.599375 603.664194 0.599766 587.870363c-0.799688-15.194065 5.29793-26.489652 18.292854-33.786802L968.921515 5.997657c5.797735-3.498633 11.795392-5.098009 18.292854-5.098008 7.696993 0 14.594299 2.199141 20.691918 6.397501 12.695041 8.996486 17.593128 21.291683 15.294025 36.385786z" p-id="2312" fill="#1296db"></path></svg></button>
                    <button id="clear-button" title="清除引用"><svg t="1705972073230" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3723" width="16" height="16"><path d="M433.230769 118.153846h157.538462v315.076923H433.230769z" fill="#BFBFBF" p-id="3724"></path><path d="M590.769231 464.738462H433.230769c-17.329231 0-31.507692-14.178462-31.507692-31.507693V118.153846c0-17.329231 14.178462-31.507692 31.507692-31.507692h157.538462c17.329231 0 31.507692 14.178462 31.507692 31.507692v315.076923c0 17.329231-14.178462 31.507692-31.507692 31.507693z m-126.030769-63.015385h94.523076V149.661538H464.738462v252.061539z" fill="#7F7F7F" p-id="3725"></path><path d="M905.846154 433.230769v157.538462H118.153846V433.230769z" fill="#BFBFBF" p-id="3726"></path><path d="M905.846154 622.276923H118.153846c-17.329231 0-31.507692-14.178462-31.507692-31.507692V433.230769c0-17.329231 14.178462-31.507692 31.507692-31.507692h787.692308c17.329231 0 31.507692 14.178462 31.507692 31.507692v157.538462c0 17.329231-14.178462 31.507692-31.507692 31.507692z m-756.184616-63.015385h724.676924V464.738462H149.661538v94.523076z" fill="#7F7F7F" p-id="3727"></path><path d="M905.846154 937.353846h-118.153846c-13.390769 0-25.993846-8.664615-29.932308-21.267692l-9.452308-28.356923-9.452307 28.356923c-3.938462 12.603077-16.541538 21.267692-29.932308 21.267692H590.769231c-8.664615 0-16.541538-3.150769-22.055385-9.452308l-56.713846-56.713846-56.713846 56.713846c-6.301538 6.301538-14.178462 9.452308-22.055385 9.452308H338.707692c-12.603077 0-24.418462-7.876923-29.144615-19.692308L275.692308 833.378462l-33.87077 84.283076c-4.726154 11.815385-16.541538 19.692308-29.144615 19.692308H118.153846c-17.329231 0-31.507692-14.178462-31.507692-31.507692V590.769231c0-17.329231 14.178462-31.507692 31.507692-31.507693h787.692308c17.329231 0 31.507692 14.178462 31.507692 31.507693v315.076923c0 17.329231-14.178462 31.507692-31.507692 31.507692z m-95.310769-63.015384h63.803077V622.276923H149.661538v252.061539h41.747693l55.138461-137.846154C251.273846 724.676923 263.089231 716.8 275.692308 716.8s24.418462 7.876923 29.144615 19.692308l55.138462 137.846154h59.864615l69.316923-69.316924c6.301538-6.301538 14.178462-9.452308 22.055385-9.452307 8.664615 0 16.541538 3.150769 22.055384 9.452307l69.316923 69.316924H685.292308l32.295384-96.886154c3.938462-12.603077 16.541538-21.267692 29.932308-21.267693 13.390769 0 25.993846 8.664615 29.932308 21.267693l33.083077 96.886154z" fill="#7F7F7F" p-id="3728"></path></svg></button>
                    <button id="text2voice" title="引用朗读"><svg t="1705972429457" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="8326" width="20" height="20"><path d="M725.333333 298.666667v426.666666h-85.333333V298.666667h85.333333zM384 298.666667v426.666666H298.666667V298.666667h85.333333z m-170.666667 128v170.666666H128v-170.666666h85.333333z m682.666667 0v170.666666h-85.333333v-170.666666h85.333333z m-341.333333-256v682.666666h-85.333334V170.666667h85.333334z" fill="#46bb4e" p-id="8327"></path></svg></button>
                    <button id="talk" title="开启/关闭语音回复"><svg t="1706080129573" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="11423" width="16" height="16"><path d="M512 0c81.538255 0 155.355406 33.090447 208.809205 86.71394a295.268603 295.268603 0 0 1 86.544245 209.233441 295.268603 295.268603 0 0 1-130.325452 245.463239 467.848011 467.848011 0 0 1 301.63215 436.454509 40.302467 40.302467 0 1 1-80.43524 0A384.61281 384.61281 0 0 0 785.208305 705.081061a385.461283 385.461283 0 0 0-272.699221-113.101451h-1.018168A385.376435 385.376435 0 0 0 238.791695 704.996213a384.61281 384.61281 0 0 0-113.016603 272.868916 40.302467 40.302467 0 1 1-80.43524 0c0-128.713354 52.265937-245.378391 136.858694-329.886301a467.338927 467.338927 0 0 1 164.773456-106.568208A295.35345 295.35345 0 0 1 216.731397 295.947381 295.35345 295.35345 0 0 1 512 0z m151.961514 143.646478A214.069737 214.069737 0 0 0 512.084847 80.604935a214.91821 214.91821 0 0 0-214.91821 215.342446 215.003057 215.003057 0 0 0 214.324279 215.342447h1.018168a215.003057 215.003057 0 0 0 214.493973-215.342447c0-59.39311-24.18148-113.271145-63.041543-152.300903z" p-id="11424"></path></svg></button>
                    <button id="t2p" title="文生图"><svg t="1706252273411" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2373" width="19" height="19"><path d="M829.64898 849.502041H194.35102c-43.885714 0-79.412245-35.526531-79.412244-79.412245V253.910204c0-43.885714 35.526531-79.412245 79.412244-79.412245h635.29796c43.885714 0 79.412245 35.526531 79.412244 79.412245v516.179592c0 43.885714-35.526531 79.412245-79.412244 79.412245z" fill="#D2F4FF" p-id="2374"></path><path d="M909.061224 656.195918l-39.706122-48.065306L626.416327 365.714286c-19.330612-19.330612-50.677551-19.330612-70.008164 0L419.526531 502.073469c-2.612245 2.612245-5.22449 3.134694-6.791837 3.134694-1.567347 0-4.702041-0.522449-6.791837-3.134694L368.326531 464.979592c-19.330612-19.330612-50.677551-19.330612-70.008164 0l-143.673469 143.673469-39.706122 48.065306v113.893878c0 43.885714 35.526531 79.412245 79.412244 79.412245h635.29796c43.885714 0 79.412245-35.526531 79.412244-79.412245v-114.416327" fill="#16C4AF" p-id="2375"></path><path d="M273.763265 313.469388m-49.632653 0a49.632653 49.632653 0 1 0 99.265306 0 49.632653 49.632653 0 1 0-99.265306 0Z" fill="#E5404F" p-id="2376"></path><path d="M644.179592 768h-365.714286c-11.493878 0-20.897959-9.404082-20.897959-20.897959s9.404082-20.897959 20.897959-20.897959h365.714286c11.493878 0 20.897959 9.404082 20.897959 20.897959s-9.404082 20.897959-20.897959 20.897959zM461.322449 670.82449h-182.857143c-11.493878 0-20.897959-9.404082-20.897959-20.897959s9.404082-20.897959 20.897959-20.89796h182.857143c11.493878 0 20.897959 9.404082 20.897959 20.89796s-9.404082 20.897959-20.897959 20.897959z" fill="#0B9682" p-id="2377"></path></svg></button>
                    <button id="speech" title="语言输入"><svg t="1705972339629" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6918" width="16" height="16"><path d="M833 445.5c17.673 0 32 14.327 32 32 0 183.722-140.553 334.616-319.997 351.021L545 895h194c17.673 0 32 14.327 32 32 0 17.673-14.327 32-32 32H287c-17.673 0-32-14.327-32-32 0-17.673 14.327-32 32-32h194l-0.003-66.389C301.075 812.677 160 661.563 160 477.5c0-17.673 14.327-32 32-32 17.496 0 31.713 14.042 31.996 31.47l0.004 0.53C224 636.834 353.166 766 512.5 766c157.74 0 285.914-126.595 288.461-283.73l0.039-4.77c0-17.673 14.327-32 32-32zM513 65c123.021 0 222.983 98.731 224.97 221.28L738 290v186c0 124.264-100.736 225-225 225-123.021 0-222.983-98.731-224.97-221.28L288 476V290c0-124.264 100.736-225 225-225z m0 64c-88.029 0-159.557 70.648-160.978 158.338L352 290v186c0 88.918 72.082 161 161 161 88.029 0 159.557-70.648 160.978-158.338L674 476V290c0-88.918-72.082-161-161-161z m124.543 258.591c17.388 89.453-41.032 176.064-130.485 193.452-17.348 3.372-34.146-7.958-37.518-25.306-3.338-17.175 7.733-33.81 24.788-37.413l0.518-0.105c54.209-10.537 89.8-62.604 80.178-116.774l-0.305-1.642c-3.372-17.348 7.958-34.146 25.306-37.518 17.349-3.372 34.146 7.958 37.518 25.306z" fill="#1296db" p-id="6919"></path></svg></button>
                </div>
            </div>
        </div>
    `;
  // 将悬浮聊天框添加到页面
  document.body.insertAdjacentHTML("beforeend", chatBoxHTML);

  // 获取聊天框和输入框
  let chatContainer = document.getElementById("chat-container");
  let messageInput = document.getElementById("message-input");

  messageInput.addEventListener("keydown", function (event) {
    checkCtrlEnter(event);
  });

  // 发送按钮, 根据 enable_talk 是否启用来看GPT是否要回复语音
  document.getElementById("send-button").addEventListener("click", function () {
    let message = messageInput.value;
    if (message.trim() !== "") {
      let sendLineDiv = genSendDiv();
      let sendMessageSpan =
        sendLineDiv.getElementsByClassName("sendMessageSpan")[0];
      sendMessageSpan.innerHTML = converter.makeHtml(message);
      let prompt = "";
      reference.forEach((ref) => {
        prompt = prompt + ref.innerText;
      });

      if (enable_talk) {
        socket.emit("prompt", {
          prompt: prompt,
          question: message,
          toVoice: true,
        });
      } else {
        socket.emit("prompt", {
          prompt: prompt,
          question: message,
          toVoice: false,
        });
      }

      chatContainer.appendChild(sendLineDiv);

      let receiveLineDiv = genReceiveDiv();
      chatContainer.appendChild(receiveLineDiv);
      document.getElementById("send-button").disabled = true;

      messageInput.value = "";

      scrollToBottom();
    }
  });
}

// 发送消息的对话框
function genSendDiv() {
  let parentDiv = document.createElement("div");
  parentDiv.style.width = "100%";
  parentDiv.style.display = "flex";
  parentDiv.style.margin = "9px 0 9px 0";
  parentDiv.style.paddingRight = "8px";

  let messageSpan = document.createElement("span");
  messageSpan.classList.add("sendMessageSpan", "markdown-body");
  parentDiv.appendChild(messageSpan);
  return parentDiv;
}

// 接受消息的对话框
function genReceiveDiv() {
  let parentDiv = document.createElement("div");
  parentDiv.style.width = "100%";
  parentDiv.style.display = "flex";
  parentDiv.style.margin = "9px 0 9px 0";
  parentDiv.style.paddingRight = "8px";

  let messageSpan = document.createElement("span");
  messageSpan.classList.add("receiveMessageSpan", "markdown-body");
  parentDiv.appendChild(messageSpan);
  return parentDiv;
}

function start() {
  parse();
  chatContainerFun();
}

start();

// =======================

// 常见问题
function genRecommendation(text) {
  let rec_btn = document.createElement("button");
  rec_btn.innerText = text;
  rec_btn.classList.add("recButton");
  rec_btn.addEventListener("click", (event) => {
    document.getElementById("message-input").value = rec_btn.innerText;
    document.getElementById("send-button").click();
  });
  return rec_btn;
}

(function () {
  let recommendation = document.getElementById("recommendation");
  let rec_text_list = [
    "简述一下这篇文章",
    "简述一下所引用内容",
    "给引用内容举个例子",
    "这篇文章的实现流程",
    "这篇文章的技术难点",
    "这篇文章主要的技术栈",
  ];
  rec_text_list.forEach((item) => {
    recommendation.appendChild(genRecommendation(item));
  });
})();

// 滚轮上下滚转为水平
document.getElementById("recommendation").addEventListener("wheel", (event) => {
  event.preventDefault();
  const delta = event.deltaY || event.detail || event.wheelDeltaY;
  document.getElementById("recommendation").scrollLeft += delta * 0.6;
});

// 有消息自动滚动到底部
function scrollToBottom() {
  let chatContainer = document.getElementById("chat-container");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

socket.on("completion_chunk", (chunk) => {
  let receiveMessageSpans =
    document.getElementsByClassName("receiveMessageSpan");
  lastReceiveMessageSpan = receiveMessageSpans[receiveMessageSpans.length - 1];
  currentContent = currentContent + chunk;
  lastReceiveMessageSpan.innerHTML = converter.makeHtml(currentContent);
  scrollToBottom();
});

socket.on("chunk_end", () => {
  currentContent = "";
  document.getElementById("send-button").disabled = false;
  scrollToBottom();
});

// 引用朗读
socket.on("t2v_audio", (buffer) => {
  const blob = new Blob([buffer], { type: "audio/mp3" });
  const url = URL.createObjectURL(blob);
  const audioPlayer = new Audio();

  audioPlayer.addEventListener("ended", () => {
    document.getElementById("text2voice").style.backgroundColor = "white";
    document.getElementById("text2voice").innerHTML =
      '<svg t="1705972429457" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="8326" width="20" height="20"><path d="M725.333333 298.666667v426.666666h-85.333333V298.666667h85.333333zM384 298.666667v426.666666H298.666667V298.666667h85.333333z m-170.666667 128v170.666666H128v-170.666666h85.333333z m682.666667 0v170.666666h-85.333333v-170.666666h85.333333z m-341.333333-256v682.666666h-85.333334V170.666667h85.333334z" fill="#46bb4e" p-id="8327"></path></svg>';
    document.getElementById("text2voice").style.disabled = false;
  });
  audioPlayer.src = url;
  audioPlayer.play();
  document.getElementById("text2voice").innerHTML =
    '<img height="18px" width="18px" src="https://raw.githubusercontent.com/thanyiz/ImageBed/main/ImageBed/Animation%20-%201706086750685%20(5).gif">';
});

// GPT 回复内容语音
socket.on("talk_audio", (buffer) => {
  const blob = new Blob([buffer], { type: "audio/mp3" });
  const url = URL.createObjectURL(blob);
  const audioPlayer = new Audio();

  audioPlayer.addEventListener("ended", () => {
    document.getElementById("talk").innerHTML =
      '<svg t="1706080084035" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="11159" width="18" height="18"><path d="M426.666667 117.333333a181.333333 181.333333 0 1 1 0 362.666667 181.333333 181.333333 0 0 1 0-362.666667z m0 64a117.333333 117.333333 0 1 0 0 234.666667 117.333333 117.333333 0 0 0 0-234.666667z m284.373333-17.92a32 32 0 0 1 42.922667 14.293334c3.498667 6.997333 8.234667 18.773333 12.8 34.688 17.834667 62.122667 17.834667 132.565333-11.818667 205.056a32 32 0 1 1-59.221333-24.234667 245.333333 245.333333 0 0 0 9.514666-163.157333 154.581333 154.581333 0 0 0-8.533333-23.765334 32 32 0 0 1 14.336-42.922666z m148.053333-84.736a32 32 0 0 1 43.52 12.458667c6.357333 11.349333 15.189333 31.232 23.893334 58.453333 34.218667 107.264 34.218667 229.077333-22.698667 354.304a32 32 0 0 1-58.282667-26.453333c49.749333-109.44 49.749333-215.210667 20.010667-308.437333-7.338667-22.912-14.506667-38.954667-18.858667-46.805334a32 32 0 0 1 12.458667-43.52zM473.6 586.666667c125.909333 0 155.861333 2.432 194.389333 22.101333a202.666667 202.666667 0 0 1 88.576 88.576c19.626667 38.528 22.101333 68.48 22.101334 194.389333v25.6a32 32 0 0 1-32 32h-640a32 32 0 0 1-32-32v-25.6c0-125.909333 2.432-155.861333 22.101333-194.389333a202.666667 202.666667 0 0 1 88.576-88.576c38.528-19.626667 68.48-22.101333 194.389333-22.101333h93.866667z m22.954667 64H356.778667c-93.952 0.384-118.869333 3.114667-142.378667 15.104a138.666667 138.666667 0 0 0-60.586667 60.586666c-12.032 23.552-14.762667 48.469333-15.104 142.421334l-0.042666 16.554666h575.957333v-5.376c-0.128-99.370667-2.432-127.146667-13.738667-150.869333l-1.322666-2.688a138.666667 138.666667 0 0 0-60.586667-60.586667c-23.552-12.032-48.469333-14.762667-142.421333-15.104z" p-id="11160"></path></svg>';
  });
  audioPlayer.src = url;
  audioPlayer.play();
  document.getElementById("talk").innerHTML =
    '<img height="18px" width="18px" src="https://raw.githubusercontent.com/thanyiz/ImageBed/main/ImageBed/Animation%20-%201706086750685%20(5).gif">';
});

// 语音输入
socket.on("speech2text", (text) => {
  let chatContainer = document.getElementById("chat-container");
  let sendLineDiv = genSendDiv();
  let sendMessageSpan =
    sendLineDiv.getElementsByClassName("sendMessageSpan")[0];
  sendMessageSpan.innerHTML = converter.makeHtml(text);
  let prompt = "";
  reference.forEach((ref) => {
    prompt = prompt + ref.innerText;
  });

  if (enable_talk) {
    socket.emit("prompt", { prompt: prompt, question: text, toVoice: true });
  } else {
    socket.emit("prompt", { prompt: prompt, question: text, toVoice: false });
  }

  chatContainer.appendChild(sendLineDiv);

  let receiveLineDiv = genReceiveDiv();
  chatContainer.appendChild(receiveLineDiv);
  document.getElementById("send-button").disabled = true;

  scrollToBottom();
});

// 监听鼠标选中, 选中显示"引用"图标
(function () {
  document.addEventListener("selectionchange", (event) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText !== "") {
      ref_selected_text = selectedText;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      const refButton = document.createElement("button");
      refButton.className = "refButton";
      refButton.style.backgroundColor = "white";
      refButton.style.pointerEvents = "auto";

      refButton.innerHTML =
        '<svg id="ref_icon" t="1705915399206" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1558" width="200" height="200"><path d="M576.967111 554.894222C576.967111 227.84 849.550222 34.844444 1024 0v192.995556c-95.402667 29.496889-209.891556 179.598222-215.324444 343.125333H1024V739.555556c0 157.098667-127.345778 284.444444-284.444444 284.444444h-162.588445V554.894222zM0 554.894222C0 227.84 272.583111 34.844444 447.032889 0v192.995556c-95.402667 29.496889-209.891556 179.598222-215.324445 343.125333h212.593778V739.555556c0 157.098667-127.345778 284.444444-284.444444 284.444444H0V554.894222z" p-id="1559"></path></svg>';
      refButton.style.padding = "5px";
      refButton.style.borderRadius = "6px";
      refButton.style.position = "absolute";
      refButton.style.border = "1px";
      refButton.style.borderStyle = "solid";
      refButton.style.borderColor = "rgba(0,0,0,0.5)";
      refButton.style.borderWidth = "1px";
      refButton.style.left = `${rect.left + window.scrollX}px`;
      refButton.style.top = `${rect.bottom + window.scrollY + 5}px`;

      refButton.addEventListener("click", (event) => {
        let messageInput = document.getElementById("message-input");
        messageInput.value = messageInput.value + ref_selected_text;
        ref_selected_text = "";
        refButton.remove();
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();
      });

      let rm_btn = document.getElementsByClassName("refButton");
      for (let i = 0; i < rm_btn.length; i++) {
        rm_btn[i].remove();
      }

      document.body.appendChild(refButton);
      document.getElementById("ref_icon").style.height = "20px";
      document.getElementById("ref_icon").style.width = "20px";
    } else {
      let rm_btn = document.getElementsByClassName("refButton");
      for (let i = 0; i < rm_btn.length; i++) {
        rm_btn[i].remove();
      }
    }
  });
})();

// 清空引用按钮
document.getElementById("clear-button").addEventListener("click", (event) => {
  reference.forEach((ref) => {
    ref.nextElementSibling.checked = false;
    let changeEvent = new Event("change");
    ref.nextElementSibling.dispatchEvent(changeEvent);
  });
});

// 引用朗读按钮
document.getElementById("text2voice").addEventListener("click", (event) => {
  let text = "";
  reference.forEach((ref) => {
    text = text + ref.innerText;
  });
  document.getElementById("text2voice").style.disabled = true;
  document.getElementById("text2voice").innerHTML =
    '<img width="18px" height="18px" src="https://raw.githubusercontent.com/thanyiz/ImageBed/main/ImageBed/system-regular-720-spinner-half-circles%20(2).gif">';
  socket.emit("t2v", text);
});

// 是否启用GPT语音回复按钮
document.getElementById("talk").addEventListener("click", (event) => {
  if (enable_talk) {
    enable_talk = false;
    document.getElementById("talk").innerHTML =
      '<svg t="1706080129573" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="11423" width="16" height="16"><path d="M512 0c81.538255 0 155.355406 33.090447 208.809205 86.71394a295.268603 295.268603 0 0 1 86.544245 209.233441 295.268603 295.268603 0 0 1-130.325452 245.463239 467.848011 467.848011 0 0 1 301.63215 436.454509 40.302467 40.302467 0 1 1-80.43524 0A384.61281 384.61281 0 0 0 785.208305 705.081061a385.461283 385.461283 0 0 0-272.699221-113.101451h-1.018168A385.376435 385.376435 0 0 0 238.791695 704.996213a384.61281 384.61281 0 0 0-113.016603 272.868916 40.302467 40.302467 0 1 1-80.43524 0c0-128.713354 52.265937-245.378391 136.858694-329.886301a467.338927 467.338927 0 0 1 164.773456-106.568208A295.35345 295.35345 0 0 1 216.731397 295.947381 295.35345 295.35345 0 0 1 512 0z m151.961514 143.646478A214.069737 214.069737 0 0 0 512.084847 80.604935a214.91821 214.91821 0 0 0-214.91821 215.342446 215.003057 215.003057 0 0 0 214.324279 215.342447h1.018168a215.003057 215.003057 0 0 0 214.493973-215.342447c0-59.39311-24.18148-113.271145-63.041543-152.300903z" p-id="11424"></path></svg>';
  } else {
    enable_talk = true;
    document.getElementById("talk").innerHTML =
      '<svg t="1706080084035" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="11159" width="18" height="18"><path d="M426.666667 117.333333a181.333333 181.333333 0 1 1 0 362.666667 181.333333 181.333333 0 0 1 0-362.666667z m0 64a117.333333 117.333333 0 1 0 0 234.666667 117.333333 117.333333 0 0 0 0-234.666667z m284.373333-17.92a32 32 0 0 1 42.922667 14.293334c3.498667 6.997333 8.234667 18.773333 12.8 34.688 17.834667 62.122667 17.834667 132.565333-11.818667 205.056a32 32 0 1 1-59.221333-24.234667 245.333333 245.333333 0 0 0 9.514666-163.157333 154.581333 154.581333 0 0 0-8.533333-23.765334 32 32 0 0 1 14.336-42.922666z m148.053333-84.736a32 32 0 0 1 43.52 12.458667c6.357333 11.349333 15.189333 31.232 23.893334 58.453333 34.218667 107.264 34.218667 229.077333-22.698667 354.304a32 32 0 0 1-58.282667-26.453333c49.749333-109.44 49.749333-215.210667 20.010667-308.437333-7.338667-22.912-14.506667-38.954667-18.858667-46.805334a32 32 0 0 1 12.458667-43.52zM473.6 586.666667c125.909333 0 155.861333 2.432 194.389333 22.101333a202.666667 202.666667 0 0 1 88.576 88.576c19.626667 38.528 22.101333 68.48 22.101334 194.389333v25.6a32 32 0 0 1-32 32h-640a32 32 0 0 1-32-32v-25.6c0-125.909333 2.432-155.861333 22.101333-194.389333a202.666667 202.666667 0 0 1 88.576-88.576c38.528-19.626667 68.48-22.101333 194.389333-22.101333h93.866667z m22.954667 64H356.778667c-93.952 0.384-118.869333 3.114667-142.378667 15.104a138.666667 138.666667 0 0 0-60.586667 60.586666c-12.032 23.552-14.762667 48.469333-15.104 142.421334l-0.042666 16.554666h575.957333v-5.376c-0.128-99.370667-2.432-127.146667-13.738667-150.869333l-1.322666-2.688a138.666667 138.666667 0 0 0-60.586667-60.586667c-23.552-12.032-48.469333-14.762667-142.421333-15.104z" p-id="11160"></path></svg>';
  }
});

// 语音输入按钮
(function () {
  document.getElementById("speech").addEventListener("click", async (event) => {
    if (!speech_btn_enable) {
      chunks = [];
      speech_btn_enable = true;
      document.getElementById("speech").innerHTML =
        '<img height="20px" width="60px" src="https://raw.githubusercontent.com/thanyiz/ImageBed/main/ImageBed/Animation%20-%201706089268505.gif">';
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks, { type: "audio/wav" });
            socket.emit("speech", audioBlob);
          };
          mediaRecorder.start();
        })
        .catch((e) => {
          console.log("getUesrMediaErr", e);
        });
    } else {
      speech_btn_enable = false;
      mediaRecorder.stop();
      document.getElementById("speech").innerHTML =
        '<svg t="1705972339629" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6918" width="16" height="16"><path d="M833 445.5c17.673 0 32 14.327 32 32 0 183.722-140.553 334.616-319.997 351.021L545 895h194c17.673 0 32 14.327 32 32 0 17.673-14.327 32-32 32H287c-17.673 0-32-14.327-32-32 0-17.673 14.327-32 32-32h194l-0.003-66.389C301.075 812.677 160 661.563 160 477.5c0-17.673 14.327-32 32-32 17.496 0 31.713 14.042 31.996 31.47l0.004 0.53C224 636.834 353.166 766 512.5 766c157.74 0 285.914-126.595 288.461-283.73l0.039-4.77c0-17.673 14.327-32 32-32zM513 65c123.021 0 222.983 98.731 224.97 221.28L738 290v186c0 124.264-100.736 225-225 225-123.021 0-222.983-98.731-224.97-221.28L288 476V290c0-124.264 100.736-225 225-225z m0 64c-88.029 0-159.557 70.648-160.978 158.338L352 290v186c0 88.918 72.082 161 161 161 88.029 0 159.557-70.648 160.978-158.338L674 476V290c0-88.918-72.082-161-161-161z m124.543 258.591c17.388 89.453-41.032 176.064-130.485 193.452-17.348 3.372-34.146-7.958-37.518-25.306-3.338-17.175 7.733-33.81 24.788-37.413l0.518-0.105c54.209-10.537 89.8-62.604 80.178-116.774l-0.305-1.642c-3.372-17.348 7.958-34.146 25.306-37.518 17.349-3.372 34.146 7.958 37.518 25.306z" fill="#1296db" p-id="6919"></path></svg>';
    }
  });
})();

document.getElementById("t2p").addEventListener("click", (event) => {
  let message = document.getElementById("message-input").value;

  if (message.trim() !== "") {
    let sendLineDiv = genSendDiv();
    let sendMessageSpan =
      sendLineDiv.getElementsByClassName("sendMessageSpan")[0];
    sendMessageSpan.innerHTML = converter.makeHtml(message);

    let prompt = "";
    reference.forEach((ref) => {
      prompt = prompt + ref.innerText;
    });
    socket.emit("t2p", { prompt: prompt, question: message });
    document.getElementById("message-input").value = "";

    let chatContainer = document.getElementById("chat-container");
    chatContainer.appendChild(sendLineDiv);

    let receiveLineDiv = genReceiveDiv();
    chatContainer.appendChild(receiveLineDiv);
  }
});

socket.on("picture", (data) => {
  console.log(data);
  let url = data[0].url;

  let receiveMessageSpans =
    document.getElementsByClassName("receiveMessageSpan");
  lastReceiveMessageSpan = receiveMessageSpans[receiveMessageSpans.length - 1];
  lastReceiveMessageSpan.innerHTML = `<img src="${url}" height="200px" width="200px">`;
});
