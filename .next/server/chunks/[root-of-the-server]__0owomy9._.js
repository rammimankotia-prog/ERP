module.exports=[918622,(e,t,a)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},556704,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},324725,(e,t,a)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},270406,(e,t,a)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},814747,(e,t,a)=>{t.exports=e.x("path",()=>require("path"))},193695,(e,t,a)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},522734,(e,t,a)=>{t.exports=e.x("fs",()=>require("fs"))},463021,(e,t,a)=>{t.exports=e.x("@prisma/client-2c3a283f134fdcb6",()=>require("@prisma/client-2c3a283f134fdcb6"))},224361,(e,t,a)=>{t.exports=e.x("util",()=>require("util"))},254799,(e,t,a)=>{t.exports=e.x("crypto",()=>require("crypto"))},233405,(e,t,a)=>{t.exports=e.x("child_process",()=>require("child_process"))},427699,(e,t,a)=>{t.exports=e.x("events",()=>require("events"))},792509,(e,t,a)=>{t.exports=e.x("url",()=>require("url"))},921517,(e,t,a)=>{t.exports=e.x("http",()=>require("http"))},524836,(e,t,a)=>{t.exports=e.x("https",()=>require("https"))},406461,(e,t,a)=>{t.exports=e.x("zlib",()=>require("zlib"))},688947,(e,t,a)=>{t.exports=e.x("stream",()=>require("stream"))},504446,(e,t,a)=>{t.exports=e.x("net",()=>require("net"))},679594,(e,t,a)=>{t.exports=e.x("dns",()=>require("dns"))},446786,(e,t,a)=>{t.exports=e.x("os",()=>require("os"))},755004,(e,t,a)=>{t.exports=e.x("tls",()=>require("tls"))},492749,e=>{"use strict";var t=e.i(129508),a=e.i(522734),r=e.i(814747);async function o({to:e,name:n,employeeId:i,password:s,role:l}){try{let o=process.env.SMTP_HOST||"smtp.gmail.com",d=Number(process.env.SMTP_PORT||"465"),p=process.env.SMTP_USER||"",c=process.env.SMTP_PASS||"",u=process.env.SMTP_FROM_NAME||"Godwin Hotels ERP Admin",f=r.default.join(process.cwd(),"data"),g=r.default.join(f,"audit_credentials.json");try{a.default.existsSync(f)||a.default.mkdirSync(f,{recursive:!0});let t=a.default.existsSync(g)?JSON.parse(a.default.readFileSync(g,"utf-8")):[];t.push({timestamp:new Date().toISOString(),to:e,employeeId:i,name:n,role:l,sent:!!(p&&c)}),a.default.writeFileSync(g,JSON.stringify(t.slice(-200),null,2))}catch{}if(!p||!c)return console.log(`[SMTP SIMULATION] Onboarding credentials for ${n} (${i}):`),console.log(`Email: ${e} | Password: ${s} | Portal: https://grandgodwin.com/login`),{success:!0,message:"Credentials generated and logged. (SMTP credentials not configured in .env; email simulated)"};let x=t.default.createTransport({host:o,port:d,secure:465===d,auth:{user:p,pass:c}}),m=process.env.NEXT_PUBLIC_APP_URL||"https://grandgodwin.com/login",h=`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #f59e0b;">
            HOTEL GRAND GODWIN &amp; GODWIN DELUXE
          </h1>
          <p style="margin: 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
            Official ERP &amp; Staff Terminal Onboarding
          </p>
        </div>

        <div style="padding: 28px 24px;">
          <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">
            Welcome to the Team, ${n}!
          </h2>
          <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
            Your employee profile and official portal credentials have been provisioned in the Godwin Enterprise ERP System. You can now access your attendance logs, duty roster, and submit leave requests directly from any device.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
            <div style="margin-bottom: 10px; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Staff ID:</span>
              <strong style="color: #0f172a; margin-left: 8px; font-family: monospace; font-size: 14px;">${i}</strong>
            </div>
            <div style="margin-bottom: 10px; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Login Portal:</span>
              <a href="${m}" style="color: #2563eb; margin-left: 8px; text-decoration: none; font-weight: 600;">${m}</a>
            </div>
            <div style="margin-bottom: 10px; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Username / Email:</span>
              <strong style="color: #0f172a; margin-left: 8px;">${e}</strong>
            </div>
            <div style="font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Assigned Role:</span>
              <span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 999px; margin-left: 8px; font-size: 12px; font-weight: 700;">${l}</span>
            </div>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 13px;">
              <span style="color: #64748b; font-weight: 600;">Temporary Password:</span>
              <span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 15px; font-weight: 800; margin-left: 8px; letter-spacing: 0.05em;">${s}</span>
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${m}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
              Access Godwin ERP Portal ➔
            </a>
          </div>

          <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
            🔒 Security Notice: Please do not share these credentials with anyone. For assistance, contact Hotel Management at mail@godwinhotels.com.
          </p>
        </div>

        <div style="background: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Hotel Grand Godwin &amp; Hotel Godwin Deluxe • Arakashan Road, Pahar Ganj, New Delhi - 110055
        </div>
      </div>
    `;return await x.sendMail({from:`"${u}" <${p}>`,to:e,subject:`Welcome to Godwin Hotels - Your ERP Credentials (${i})`,html:h}),{success:!0,message:`Credentials successfully dispatched to ${e}`}}catch(e){return console.error("Failed to send credentials email:",e),{success:!1,message:"Failed to send credentials email",error:e.message}}}async function n({to:e,name:a,employeeId:r,fromDate:o,toDate:i,leaveType:s="Approved Leave",approverNote:l="Approved by Management"}){try{let n=process.env.SMTP_HOST||"smtp.gmail.com",d=Number(process.env.SMTP_PORT||"465"),p=process.env.SMTP_USER||"",c=process.env.SMTP_PASS||"",u=process.env.SMTP_FROM_NAME||"Godwin Hotels HR Administration";if(!p||!c)return console.log(`[SMTP SIMULATION] Leave Approval Notification for ${a} (${r}):`),console.log(`To: ${e} | Dates: ${o} to ${i} | Type: ${s}`),{success:!0,message:"Leave approval email simulated (SMTP credentials not configured in .env)"};let f=t.default.createTransport({host:n,port:d,secure:465===d,auth:{user:p,pass:c}}),g=`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #fde68a;">
            HOTEL GRAND GODWIN &amp; GODWIN DELUXE
          </h1>
          <p style="margin: 0; font-size: 13px; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.05em;">
            HR Leave Approval Notice
          </p>
        </div>

        <div style="padding: 28px 24px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 28px;">
              ✓
            </div>
            <h2 style="margin: 12px 0 4px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
              Leave Request Approved
            </h2>
            <p style="margin: 0; font-size: 14px; color: #64748b;">
              Dear <strong>${a}</strong>, your leave request has been reviewed and officially approved.
            </p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Staff ID:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right; font-family: monospace;">${r}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Leave Type:</td>
                <td style="padding: 6px 0; color: #059669; font-weight: 700; text-align: right;">${s}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">From Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right;">${o}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">To Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 700; text-align: right;">${i}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Approver Remarks:</td>
                <td style="padding: 6px 0; color: #0f172a; font-style: italic; text-align: right;">${l}</td>
              </tr>
            </table>
          </div>

          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #065f46; line-height: 1.4;">
            🔒 <strong>Duty Roster Notice:</strong> Your duty roster and Security Gate Kiosk records have been automatically updated with official <strong>Approved Leave (Non-Amended)</strong> status for the specified period.
          </div>

          <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
            For queries or extensions, please contact the HR Management Department at mail@godwinhotels.com.
          </p>
        </div>

        <div style="background: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Hotel Grand Godwin &amp; Hotel Godwin Deluxe • Arakashan Road, Pahar Ganj, New Delhi - 110055
        </div>
      </div>
    `;return await f.sendMail({from:`"${u}" <${p}>`,to:e,subject:`✅ Leave Request Approved (${o} to ${i}) - Godwin Hotels`,html:g}),{success:!0,message:`Leave approval notice dispatched to ${e}`}}catch(e){return console.error("Failed to send leave approval email:",e),{success:!1,message:"Failed to send leave approval email",error:e.message}}}e.s(["sendEmployeeCredentials",0,o,"sendLeaveApprovalEmail",0,n])},418451,e=>{"use strict";var t=e.i(747909),a=e.i(174017),r=e.i(996250),o=e.i(759756),n=e.i(561916),i=e.i(174677),s=e.i(869741),l=e.i(316795),d=e.i(487718),p=e.i(995169),c=e.i(47587),u=e.i(666012),f=e.i(570101),g=e.i(626937),x=e.i(670909),m=e.i(193695);e.i(52474);var h=e.i(600220),v=e.i(89171),y=e.i(463021),w=e.i(522734),b=e.i(814747),R=e.i(492749);let S=new y.PrismaClient,A=process.env.PERSISTENT_DATA_DIR||b.default.join(process.cwd(),"data"),E=b.default.join(process.cwd(),"data");b.default.join(A,"hr_leaves.json"),b.default.join(E,"hr_leaves.json");let P=b.default.join(A,"hr_employees.json"),D=b.default.join(E,"hr_employees.json"),T=b.default.join(A,"notifications.json"),N=b.default.join(E,"notifications.json");function I(e,t,a){for(let a of[e,t])try{if(w.default.existsSync(a)){let e=w.default.readFileSync(a,"utf-8"),t=JSON.parse(e);if(null!=t)return t}}catch{}return a}async function O(t,a){let{id:r}=await a.params,o=t.headers.get("x-user-role")?.toUpperCase();if(o&&!["ADMIN","MASTER ADMIN","MANAGER","HR_MANAGER","HOD"].includes(o))return v.NextResponse.json({error:"Forbidden"},{status:403});let n="admin",i="Approved by HR / Administration";try{let e=await t.json();e.approverId&&(n=e.approverId),e.approverNote&&(i=e.approverNote)}catch{}let s=null;try{let e=await S.leaveRequest.findUnique({where:{id:r},include:{leaveType:!0}});if(e){s=e;let t=await S.leaveRequest.update({where:{id:r},data:{status:"APPROVED",approverId:n,approverNote:i,approvedAt:new Date}});s={...s,...t},await S.leaveBalance.updateMany({where:{employeeId:e.employeeId,leaveTypeId:e.leaveTypeId,year:new Date().getFullYear()},data:{usedDays:{increment:e.totalDays},remainingDays:{decrement:e.totalDays}}}).catch(()=>{});let a=new Date(e.fromDate),o=new Date(e.toDate);for(let t=new Date(a);t<=o;t.setDate(t.getDate()+1)){let a=new Date(t);a.setHours(0,0,0,0),await S.attendanceLog.upsert({where:{employeeId_date:{employeeId:e.employeeId,date:a}},create:{employeeId:e.employeeId,date:a,status:"ON_LEAVE"},update:{status:"ON_LEAVE"}}).catch(()=>{})}await S.auditTrail.create({data:{actorId:n||"system",targetId:r,action:"LEAVE_APPROVE"}}).catch(()=>{})}}catch{}let{updateLeaveRecord:l}=await e.A(252151),d=l(r,{status:"APPROVED",approverId:n,approverNote:i,approvedAt:new Date().toISOString()});d?s=d:s||(s={id:r,status:"APPROVED",fromDate:new Date().toISOString(),toDate:new Date().toISOString()});let p=I(P,D,[]),c=s.employeeId||s.employeeCode,u=p.find(e=>e.id===c||e.employeeId===c),f=u?`${u.firstName||""} ${u.lastName||""}`.trim():s.employeeName||"Staff Member",g=u?.email||s.email,x=s.fromDate?String(s.fromDate).slice(0,10):"",m=s.toDate?String(s.toDate).slice(0,10):"",h=s.leaveTypeName||s.leaveType?.name||"Leave",y=I(T,N,[]),A={id:`notif-leave-${Date.now()}-${Math.floor(1e3*Math.random())}`,employeeId:c,employeeCode:u?.employeeId||s.employeeCode||c,employeeName:f,type:"LEAVE_APPROVED",title:"🌴 Leave Request Approved!",message:`Your leave request for ${x} to ${m} (${h}) has been APPROVED by Management.`,fromDate:x,toDate:m,leaveType:h,approverNote:i,read:!1,createdAt:new Date().toISOString(),metadata:{leaveId:r,approverId:n,approverNote:i}};y.unshift(A);for(let e of[T,N])try{let t=b.default.dirname(e);w.default.existsSync(t)||w.default.mkdirSync(t,{recursive:!0}),w.default.writeFileSync(e,JSON.stringify(y,null,2),"utf-8")}catch(t){console.error(`Error writing to ${e}:`,t)}return g&&(0,R.sendLeaveApprovalEmail)({to:g,name:f,employeeId:u?.employeeId||c||"Staff",fromDate:x,toDate:m,leaveType:h,approverNote:i}).catch(e=>{console.error("Error dispatching leave approval email:",e)}),v.NextResponse.json({success:!0,message:"Leave approved and notification sent successfully",updated:s,notification:A})}e.s(["PUT",0,O],907794);var _=e.i(907794);let M=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/hr/leave/[id]/approve/route",pathname:"/api/hr/leave/[id]/approve",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/hr/leave/[id]/approve/route.ts",nextConfigOutput:"",userland:_,...{}}),{workAsyncStorage:q,workUnitAsyncStorage:$,serverHooks:C}=M;async function k(e,t,r){r.requestMeta&&(0,o.setRequestMeta)(e,r.requestMeta),M.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let v="/api/hr/leave/[id]/approve/route";v=v.replace(/\/index$/,"")||"/";let y=await M.prepare(e,t,{srcPage:v,multiZoneDraftMode:!1});if(!y)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:w,params:b,nextConfig:R,parsedUrl:S,isDraftMode:A,prerenderManifest:E,routerServerContext:P,isOnDemandRevalidate:D,revalidateOnlyGenerated:T,resolvedPathname:N,clientReferenceManifest:I,serverActionsManifest:O}=y,_=(0,s.normalizeAppPath)(v),q=!!(E.dynamicRoutes[_]||E.routes[N]),$=async()=>((null==P?void 0:P.render404)?await P.render404(e,t,S,!1):t.end("This page could not be found"),null);if(q&&!A){let e=!!E.routes[N],t=E.dynamicRoutes[_];if(t&&!1===t.fallback&&!e){if(R.adapterPath)return await $();throw new m.NoFallbackError}}let C=null;!q||M.isDev||A||(C="/index"===(C=N)?"/":C);let k=!0===M.isDev||!q,j=q&&!k;O&&I&&(0,i.setManifestsSingleton)({page:v,clientReferenceManifest:I,serverActionsManifest:O});let H=e.method||"GET",L=(0,n.getTracer)(),U=L.getActiveScopeSpan(),z=!!(null==P?void 0:P.isWrappedByNextServer),G=!!(0,o.getRequestMeta)(e,"minimalMode"),F=(0,o.getRequestMeta)(e,"incrementalCache")||await M.getIncrementalCache(e,R,E,G);null==F||F.resetRequestCache(),globalThis.__incrementalCache=F;let V={params:b,previewProps:E.preview,renderOpts:{experimental:{authInterrupts:!!R.experimental.authInterrupts},cacheComponents:!!R.cacheComponents,supportsDynamicResponse:k,incrementalCache:F,cacheLifeProfiles:R.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,o)=>M.onRequestError(e,t,r,o,P)},sharedContext:{buildId:w}},B=new l.NodeNextRequest(e),K=new l.NodeNextResponse(t),W=d.NextRequestAdapter.fromNodeNextRequest(B,(0,d.signalFromNodeResponse)(t));try{let o,i=async e=>M.handle(W,V).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=L.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=a.get("next.route");if(r){let t=`${H} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t),o&&o!==e&&(o.setAttribute("http.route",r),o.updateName(t))}else e.updateName(`${H} ${v}`)}),s=async o=>{var n,s;let l=async({previousCacheEntry:a})=>{try{if(!G&&D&&T&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(o);e.fetchMetrics=V.renderOpts.fetchMetrics;let s=V.renderOpts.pendingWaitUntil;s&&r.waitUntil&&(r.waitUntil(s),s=void 0);let l=V.renderOpts.collectedTags;if(!q)return await (0,u.sendResponse)(B,K,n,V.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,f.toNodeOutgoingHttpHeaders)(n.headers);l&&(t[x.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==V.renderOpts.collectedRevalidate&&!(V.renderOpts.collectedRevalidate>=x.INFINITE_CACHE)&&V.renderOpts.collectedRevalidate,r=void 0===V.renderOpts.collectedExpire||V.renderOpts.collectedExpire>=x.INFINITE_CACHE?void 0:V.renderOpts.collectedExpire;return{value:{kind:h.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:r}}}}catch(t){throw(null==a?void 0:a.isStale)&&await M.onRequestError(e,t,{routerKind:"App Router",routePath:v,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:D})},!1,P),t}},d=await M.handleResponse({req:e,nextConfig:R,cacheKey:C,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:E,isRoutePPREnabled:!1,isOnDemandRevalidate:D,revalidateOnlyGenerated:T,responseGenerator:l,waitUntil:r.waitUntil,isMinimalMode:G});if(!q)return null;if((null==d||null==(n=d.value)?void 0:n.kind)!==h.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(s=d.value)?void 0:s.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});G||t.setHeader("x-nextjs-cache",D?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),A&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,f.fromNodeOutgoingHttpHeaders)(d.value.headers);return G&&q||p.delete(x.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,g.getCacheControlHeader)(d.cacheControl)),await (0,u.sendResponse)(B,K,new Response(d.value.body,{headers:p,status:d.value.status||200})),null};z&&U?await s(U):(o=L.getActiveScopeSpan(),await L.withPropagatedContext(e.headers,()=>L.trace(p.BaseServerSpan.handleRequest,{spanName:`${H} ${v}`,kind:n.SpanKind.SERVER,attributes:{"http.method":H,"http.target":e.url}},s),void 0,!z))}catch(t){if(t instanceof m.NoFallbackError||await M.onRequestError(e,t,{routerKind:"App Router",routePath:_,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:D})},!1,P),q)throw t;return await (0,u.sendResponse)(B,K,new Response(null,{status:500})),null}}e.s(["handler",0,k,"patchFetch",0,function(){return(0,r.patchFetch)({workAsyncStorage:q,workUnitAsyncStorage:$})},"routeModule",0,M,"serverHooks",0,C,"workAsyncStorage",0,q,"workUnitAsyncStorage",0,$],418451)},252151,e=>{e.v(t=>Promise.all(["server/chunks/src_lib_13ytzvh._.js"].map(t=>e.l(t))).then(()=>t(499081)))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0owomy9._.js.map