(window.webpackJsonp=window.webpackJsonp||[]).push([[23],{"0Sy+":function(e,t,n){"use strict";n.r(t),n.d(t,"pageQuery",(function(){return d}));var o=n("ERkP"),a=n.n(o),r=n("9Dj+"),l=n("yVh0"),c=n("I56Z"),i=n("GO2c"),s=(n("2oau"),n("i0GD"),n("1P1P")),u=function(e){var t=Object(c.a)(Object(l.a)()),n=e.data.markdownRemark;return n?(Object(o.useEffect)((function(){var e=document.querySelectorAll(".tsconfig nav li a");e.forEach((function(e){e.addEventListener("click",(function(e){e.preventDefault(),document.querySelector(e.target.hash).scrollIntoView({behavior:"smooth",block:"start"})}))}));var t=function(){var t,n=window.scrollY;e.forEach((function(e){var o=document.querySelector(e.hash);o&&(o.offsetTop-100<=n&&(t=e))})),e.forEach((function(e){e===t?e.classList.add("current"):e.classList.remove("current")}))};return window.addEventListener("scroll",t,{passive:!0,capture:!0}),t(),Object(s.setupTwoslashHovers)(),function(){window.removeEventListener("scroll",t)}}),[]),a.a.createElement(r.a,{title:t("tsconfig_title"),description:t("tsconfig_description"),lang:e.pageContext.locale,allSitePage:e.data.allSitePage},a.a.createElement("div",{className:"tsconfig raised main-content-block"},a.a.createElement("div",{dangerouslySetInnerHTML:{__html:n.html}})))):(console.log("Could not render:",JSON.stringify(e)),a.a.createElement("div",null))},d="1502950449";t.default=function(e){return a.a.createElement(i.a,{locale:e.pageContext.locale},a.a.createElement(u,e))}},"1P1P":function(e,t,n){"use strict";t.__esModule=!0,t.setupTwoslashHovers=void 0;var o=function(){var e=document.getElementById("twoslash-mouse-hover-info");e&&(e.style.display="none")};t.setupTwoslashHovers=function(){var e=document.querySelectorAll(".shiki.lsp .code-container code"),t=function(e){var t=e.target;if("DATA-LSP"!==t.nodeName)return o();var n,a,r,l,c=t.getAttribute("lsp"),i=(n=t,a=document.body.getBoundingClientRect(),{top:(r=n.getBoundingClientRect()).top-a.top,left:r.left-a.left}),s=((l=document.getElementById("twoslash-mouse-hover-info"))||((l=document.createElement("div")).style.position="absolute",l.id="twoslash-mouse-hover-info",document.body.appendChild(l)),l),u=document.createElement("textarea");u.innerHTML=c,s.textContent=u.value;s.style.display="block",s.style.top=i.top+20+"px",s.style.left=i.left+"px";var d=function e(t){return"pre"===t.nodeName.toLowerCase()?t.getBoundingClientRect():e(t.parentElement)}(t),f=i.left-d.x;s.style.maxWidth=d.width-f+"px"};e.forEach((function(e){e.addEventListener("mouseover",t),e.addEventListener("mouseout",o)}))}}}]);
//# sourceMappingURL=component---src-templates-tsconfig-reference-tsx-a477ed47a2948755a1a1.js.map