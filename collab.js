// collab.js — /collab command module
"use strict";
const {
  MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ChannelType, PermissionsBitField,
} = require("discord.js");

const COLLAB_CONFIG = {
  defaultCollabChannelId: "1465608454914707559",
  approvalChannelId:      "1480573816974479512",
  adminRoleId:            "1483176429393940663",
  collabCategoryId:       null,
};

let L = { debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{} };
function init(logger) { L = logger; }

const sessions = new Map();
const collabs  = new Map();
let ctr = 0;
function mkId() { return `c${++ctr}_${Date.now()}`; }

function isAdmin(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (COLLAB_CONFIG.adminRoleId) return member.roles.cache.has(COLLAB_CONFIG.adminRoleId);
  return false;
}

function parseParts(str) {
  return str.split(",").map(s=>s.trim()).filter(Boolean).map(name=>({name,userId:null,userTag:null}));
}

function buildCollabInfo(c) {
  const partLines = c.parts.map((p,i)=>`**${i+1}. ${p.name}** — ${p.userId?`<@${p.userId}>`:"*(open)*"}`).join("\n");
  const inner = [
    {type:10, content:`# 🎵 ${c.name}`},
    {type:14, divider:true, spacing:1},
    {type:10, content:`**Host:** <@${c.hostId}>\n**Description:** ${c.description}\n**Song:** ${c.song}\n**Length:** ${c.length}`},
    {type:14, divider:true, spacing:1},
    {type:10, content:`**Difficulty:** ${c.difficulty}\n**Decoration:** ${c.decoration}\n**Requirements:** ${c.requirements}`},
  ];
  if (c.parts.length > 0) {
    inner.push({type:14, divider:true, spacing:1});
    inner.push({type:10, content:`**Parts (${c.parts.filter(p=>!p.userId).length} open / ${c.parts.length} total)**\n${partLines}`});
  }
  return [{type:17, components:inner}];
}

function buildPartButtons(c) {
  const rows = [];
  const btns = c.parts.slice(0,25).map((p,i)=>({
    type:2, style:p.userId?2:1,
    label:p.name.slice(0,80),
    custom_id:`collab_take_${c.id}_${i}`,
    disabled:!!p.userId,
  }));
  for (let i=0;i<btns.length;i+=5) rows.push({type:1,components:btns.slice(i,i+5)});
  rows.push({type:1,components:[
    {type:2,style:1,label:"🛠 Manage Parts",custom_id:`collab_manage_${c.id}`},
    {type:2,style:4,label:"❌ Close Collab",custom_id:`collab_close_${c.id}`},
  ]});
  return rows;
}

function buildEditor(s) {
  const pp = s.parts.length ? s.parts.map(p=>p.name).join(", ").slice(0,120) : "*(none set)*";
  return [
    {type:10, content:"## 🎵  Collab Creator"},
    {type:14, divider:true, spacing:1},
    {type:10, content:`**Name:** ${s.name||"*(not set)*"}\n**Song:** ${s.song||"*(not set)*"}\n**Length:** ${s.length||"*(not set)*"}`},
    {type:14, divider:false, spacing:1},
    {type:10, content:`**Description:** ${s.description||"*(not set)*"}`},
    {type:14, divider:false, spacing:1},
    {type:10, content:`**Difficulty:** ${s.difficulty||"*(not set)*"}\n**Requirements:** ${s.requirements||"*(not set)*"}\n**Decoration:** ${s.decoration||"*(not set)*"}`},
    {type:14, divider:false, spacing:1},
    {type:10, content:`**Parts:** ${pp}`},
    {type:14, divider:false, spacing:1},
    {type:10, content:`**Channel:** ${s.ownChannel?"✅ Bot creates a dedicated channel":"📢 Posts in <#"+COLLAB_CONFIG.defaultCollabChannelId+">"}`},
    {type:14, divider:true, spacing:1},
    {type:10, content:"-# Fill in all fields then submit for admin approval."},
    {type:1, components:[
      {type:2,style:1,label:"✏️ Name & Song",  custom_id:"collab_edit_basics"},
      {type:2,style:1,label:"✏️ Description",  custom_id:"collab_edit_desc"},
      {type:2,style:1,label:"✏️ Details",      custom_id:"collab_edit_details"},
    ]},
    {type:1, components:[
      {type:2,style:1,label:"✏️ Parts",custom_id:"collab_edit_parts"},
      {type:2,style:s.ownChannel?3:2,label:s.ownChannel?"✅ Own Channel":"📢 Shared Channel",custom_id:"collab_toggle_channel"},
    ]},
    {type:1, components:[
      {type:2,style:2,label:"👁 Preview", custom_id:"collab_preview"},
      {type:2,style:3,label:"📨 Submit",  custom_id:"collab_submit"},
      {type:2,style:4,label:"✖ Cancel",  custom_id:"collab_cancel"},
    ]},
  ];
}

function buildApprovalMsg(c) {
  return [
    {type:17, components:[
      {type:10, content:"## 🔔  New Collab Request"},
      {type:14, divider:true, spacing:1},
      {type:10, content:`**Host:** <@${c.hostId}> (${c.hostTag})\n**Name:** ${c.name}\n**Song:** ${c.song}\n**Parts:** ${c.parts.length}\n**Own channel:** ${c.ownChannel?"Yes":"No"}`},
    ]},
    {type:1, components:[
      {type:2,style:3,label:"✅ Approve",custom_id:`collab_approve_${c.id}`},
      {type:2,style:4,label:"❌ Deny",   custom_id:`collab_deny_${c.id}`},
    ]},
  ];
}

// Modals — no placeholder examples
function modalBasics() {
  return new ModalBuilder().setCustomId("collab_modal_basics").setTitle("Name & Song")
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Collab name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("song").setLabel("Song name or ID").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("length").setLabel("Length").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
    );
}
function modalDesc() {
  return new ModalBuilder().setCustomId("collab_modal_desc").setTitle("Description")
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Describe your collab").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));
}
function modalDetails() {
  return new ModalBuilder().setCustomId("collab_modal_details").setTitle("Details")
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("difficulty").setLabel("Difficulty").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("requirements").setLabel("Requirements").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("decoration").setLabel("Decoration style").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
    );
}
function modalParts() {
  return new ModalBuilder().setCustomId("collab_modal_parts").setTitle("Parts")
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("parts").setLabel("Parts (comma-separated)").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)));
}

async function handleCommand(interaction) {
  L.info("COLLAB","/collab by",interaction.user.tag);
  const s={userId:interaction.user.id,guildId:interaction.guildId,name:"",description:"",song:"",length:"",difficulty:"",requirements:"",decoration:"",parts:[],ownChannel:false};
  sessions.set(interaction.user.id,s);
  await interaction.reply({components:buildEditor(s),flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
}

async function handleButton(interaction) {
  const cid=interaction.customId;
  L.debug("COLLAB","Button",{cid,user:interaction.user.tag});

  if (cid==="collab_edit_basics") { const s=sessions.get(interaction.user.id); if(!s) return expired(interaction); await interaction.showModal(modalBasics()); return; }
  if (cid==="collab_edit_desc")   { const s=sessions.get(interaction.user.id); if(!s) return expired(interaction); await interaction.showModal(modalDesc());   return; }
  if (cid==="collab_edit_details"){ const s=sessions.get(interaction.user.id); if(!s) return expired(interaction); await interaction.showModal(modalDetails()); return; }
  if (cid==="collab_edit_parts")  { const s=sessions.get(interaction.user.id); if(!s) return expired(interaction); await interaction.showModal(modalParts());   return; }

  if (cid==="collab_toggle_channel") {
    const s=sessions.get(interaction.user.id); if(!s) return expired(interaction);
    s.ownChannel=!s.ownChannel;
    await interaction.deferUpdate();
    await interaction.editReply({components:buildEditor(s),flags:MessageFlags.IsComponentsV2}); return;
  }
  if (cid==="collab_preview") {
    const s=sessions.get(interaction.user.id); if(!s) return expired(interaction);
    await interaction.reply({components:[{type:10,content:"-# 👁  Preview — only visible to you"},{type:14,divider:true,spacing:1},...buildCollabInfo({...s,hostId:interaction.user.id})],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return;
  }
  if (cid==="collab_submit") {
    const s=sessions.get(interaction.user.id); if(!s) return expired(interaction);
    const miss=[];
    if(!s.name)miss.push("Name"); if(!s.song)miss.push("Song"); if(!s.description)miss.push("Description");
    if(!s.length)miss.push("Length"); if(!s.difficulty)miss.push("Difficulty");
    if(!s.requirements)miss.push("Requirements"); if(!s.decoration)miss.push("Decoration");
    if(!s.parts.length)miss.push("Parts");
    if(miss.length){await interaction.reply({components:[{type:17,components:[{type:10,content:`❌  Please fill in: **${miss.join(", ")}**`}]}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    const c={id:mkId(),hostId:interaction.user.id,hostTag:interaction.user.tag,guildId:interaction.guildId,...s,parts:[...s.parts],status:"pending",roleId:null,channelId:null,pendingMsgId:null,pendingChannelId:null,mainMsgId:null};
    collabs.set(c.id,c); sessions.delete(interaction.user.id);
    L.info("COLLAB","Submitted",{id:c.id,name:c.name});
    const aChan=interaction.guild.channels.cache.get(COLLAB_CONFIG.approvalChannelId);
    if(aChan){
      try{const msg=await aChan.send({components:buildApprovalMsg(c),flags:MessageFlags.IsComponentsV2});c.pendingMsgId=msg.id;L.info("COLLAB","Approval sent",msg.id);}
      catch(e){L.error("COLLAB","❌ Approval send failed",e.message);}
    }else{L.warn("COLLAB","⚠️ Approval channel not found",COLLAB_CONFIG.approvalChannelId);}
    await interaction.update({components:[{type:17,components:[{type:10,content:`✅  **${c.name}** submitted for admin approval!`}]}],flags:MessageFlags.IsComponentsV2}); return;
  }
  if (cid==="collab_cancel") {
    sessions.delete(interaction.user.id);
    await interaction.update({components:[{type:10,content:"✖  Cancelled."}],flags:MessageFlags.IsComponentsV2}); return;
  }

  if (cid.startsWith("collab_approve_")||cid.startsWith("collab_deny_")) {
    const approve=cid.startsWith("collab_approve_");
    const cid2=cid.replace("collab_approve_","").replace("collab_deny_","");
    const c=collabs.get(cid2);
    if(!c){await interaction.reply({components:[{type:10,content:"❌  Collab not found."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    if(!isAdmin(interaction.member)){await interaction.reply({components:[{type:10,content:"❌  Admin role required."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    if(!approve){
      c.status="denied"; L.info("COLLAB","Denied",{id:c.id,by:interaction.user.tag});
      await interaction.update({components:[{type:17,components:[{type:10,content:`❌  **${c.name}** denied by <@${interaction.user.id}>.`}]}],flags:MessageFlags.IsComponentsV2});
      try{const h=await interaction.client.users.fetch(c.hostId);await h.send({components:[{type:17,components:[{type:10,content:`❌  Your collab **${c.name}** was denied.`}]}],flags:MessageFlags.IsComponentsV2});}catch(e){L.warn("COLLAB","⚠️ DM host failed",e.message);}
      return;
    }
    c.status="approved"; L.info("COLLAB","Approved",{id:c.id,name:c.name});
    const guild=interaction.guild;
    try{const role=await guild.roles.create({name:`collab: ${c.name}`.slice(0,100),color:Math.floor(Math.random()*0xFFFFFF),mentionable:true,reason:`Collab: ${c.name}`});c.roleId=role.id;L.info("COLLAB","Role created",role.id);}
    catch(e){L.error("COLLAB","❌ Role create failed",e.message);}
    if(c.roleId){try{const hm=await guild.members.fetch(c.hostId);await hm.roles.add(c.roleId);}catch(e){L.warn("COLLAB","⚠️ Give role to host failed",e.message);}}
    let tChan;
    if(c.ownChannel){
      try{
        const opts={name:c.name.toLowerCase().replace(/[^a-z0-9]/g,"-").slice(0,100),type:ChannelType.GuildText,topic:`${c.name} | Host: ${c.hostTag}`,reason:`Collab: ${c.name}`,
          permissionOverwrites:[{id:guild.roles.everyone,deny:[PermissionsBitField.Flags.ViewChannel]}]};
        if(COLLAB_CONFIG.collabCategoryId)opts.parent=COLLAB_CONFIG.collabCategoryId;
        if(c.roleId)opts.permissionOverwrites.push({id:c.roleId,allow:[PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages]});
        tChan=await guild.channels.create(opts);c.channelId=tChan.id;L.info("COLLAB","Channel created",tChan.id);
      }catch(e){L.error("COLLAB","❌ Channel create failed",e.message);tChan=guild.channels.cache.get(COLLAB_CONFIG.defaultCollabChannelId);}
    }else{tChan=guild.channels.cache.get(COLLAB_CONFIG.defaultCollabChannelId);}
    if(!tChan){await interaction.reply({components:[{type:10,content:"❌  No target channel found."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    try{const msg=await tChan.send({components:[...buildCollabInfo(c),...buildPartButtons(c)],flags:MessageFlags.IsComponentsV2});c.mainMsgId=msg.id;L.info("COLLAB","Posted",msg.id);}
    catch(e){L.error("COLLAB","❌ Post failed",e.message);}
    await interaction.update({components:[{type:17,components:[{type:10,content:`✅  **${c.name}** approved! Posted in <#${tChan.id}>.`}]}],flags:MessageFlags.IsComponentsV2});
    try{const h=await interaction.client.users.fetch(c.hostId);await h.send({components:[{type:17,components:[{type:10,content:`✅  Your collab **${c.name}** was approved! Check <#${tChan.id}>.`}]}],flags:MessageFlags.IsComponentsV2});}catch(e){L.warn("COLLAB","⚠️ DM host failed",e.message);}
    return;
  }

  if(cid.startsWith("collab_take_")){
    const rest=cid.replace("collab_take_","");
    const li=rest.lastIndexOf("_"); const collabId=rest.slice(0,li); const idx=parseInt(rest.slice(li+1),10);
    const c=collabs.get(collabId);
    if(!c){await interaction.reply({components:[{type:10,content:"❌  Collab not found."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    const part=c.parts[idx];
    if(!part){await interaction.reply({components:[{type:10,content:"❌  Part not found."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    if(part.userId){await interaction.reply({components:[{type:10,content:`❌  **${part.name}** is already taken by <@${part.userId}>.`}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    part.userId=interaction.user.id;part.userTag=interaction.user.tag;
    L.info("COLLAB","Part taken",{collab:c.name,part:part.name,user:interaction.user.tag});
    if(c.roleId){try{const m=await interaction.guild.members.fetch(interaction.user.id);await m.roles.add(c.roleId);}catch(e){L.warn("COLLAB","⚠️ Give role failed",e.message);}}
    await refreshMsg(interaction,c);
    await interaction.reply({components:[{type:17,components:[{type:10,content:`✅  You joined **${c.name}** for the part: **${part.name}**!`}]}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return;
  }
  if(cid.startsWith("collab_manage_")){
    const collabId=cid.replace("collab_manage_",""); const c=collabs.get(collabId);
    if(!c){await interaction.reply({components:[{type:10,content:"❌  Not found."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    if(interaction.user.id!==c.hostId&&!isAdmin(interaction.member)){await interaction.reply({components:[{type:10,content:"❌  Host or admin only."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    await interaction.showModal(new ModalBuilder().setCustomId(`collab_modal_manage_${collabId}`).setTitle("Reset a Part")
      .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("pn").setLabel(`Part number to reset (1-${c.parts.length})`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(3)))); return;
  }
  if(cid.startsWith("collab_close_")){
    const collabId=cid.replace("collab_close_",""); const c=collabs.get(collabId);
    if(!c){await interaction.reply({components:[{type:10,content:"❌  Not found."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    if(interaction.user.id!==c.hostId&&!isAdmin(interaction.member)){await interaction.reply({components:[{type:10,content:"❌  Host or admin only."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    c.status="closed";
    await interaction.update({components:[{type:17,components:[{type:10,content:`🔒  **${c.name}** has been closed.`}]}],flags:MessageFlags.IsComponentsV2}); return;
  }
}

async function handleModal(interaction) {
  const cid=interaction.customId;
  L.debug("COLLAB","Modal",{cid,user:interaction.user.tag});
  if(["collab_modal_basics","collab_modal_desc","collab_modal_details","collab_modal_parts"].includes(cid)){
    const s=sessions.get(interaction.user.id); if(!s) return expired(interaction);
    if(cid==="collab_modal_basics"){s.name=interaction.fields.getTextInputValue("name");s.song=interaction.fields.getTextInputValue("song");s.length=interaction.fields.getTextInputValue("length");}
    else if(cid==="collab_modal_desc")    s.description=interaction.fields.getTextInputValue("description");
    else if(cid==="collab_modal_details"){s.difficulty=interaction.fields.getTextInputValue("difficulty");s.requirements=interaction.fields.getTextInputValue("requirements");s.decoration=interaction.fields.getTextInputValue("decoration");}
    else if(cid==="collab_modal_parts")   s.parts=parseParts(interaction.fields.getTextInputValue("parts"));
    sessions.set(interaction.user.id,s);
    await interaction.deferUpdate();
    await interaction.editReply({components:buildEditor(s),flags:MessageFlags.IsComponentsV2}); return;
  }
  if(cid.startsWith("collab_modal_manage_")){
    const collabId=cid.replace("collab_modal_manage_",""); const c=collabs.get(collabId); if(!c)return;
    const idx=parseInt(interaction.fields.getTextInputValue("pn"),10)-1;
    if(isNaN(idx)||idx<0||idx>=c.parts.length){await interaction.reply({components:[{type:10,content:`❌  Invalid part number. Range: 1–${c.parts.length}.`}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});return;}
    const p=c.parts[idx]; const old=p.userId; p.userId=null; p.userTag=null;
    L.info("COLLAB","Part reset",{collab:c.name,part:p.name,was:old});
    await interaction.deferUpdate(); await refreshMsg(interaction,c);
    await interaction.followUp({components:[{type:17,components:[{type:10,content:`✅  **${p.name}** is now open again.`}]}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral}); return;
  }
}

async function refreshMsg(interaction,c){
  const chId=c.channelId||COLLAB_CONFIG.defaultCollabChannelId;
  if(!chId||!c.mainMsgId)return;
  try{
    const ch=interaction.guild.channels.cache.get(chId); if(!ch)return;
    const msg=await ch.messages.fetch(c.mainMsgId);
    await msg.edit({components:[...buildCollabInfo(c),...buildPartButtons(c)],flags:MessageFlags.IsComponentsV2});
  }catch(e){L.warn("COLLAB","⚠️ Refresh failed",e.message);}
}

async function expired(interaction){
  await interaction.reply({components:[{type:10,content:"❌  Session expired. Run `/collab` again."}],flags:MessageFlags.IsComponentsV2|MessageFlags.Ephemeral});
}

module.exports = {
  init, handleCommand, handleButton, handleModal,
  isCollabButton:(cid)=>cid.startsWith("collab_"),
  isCollabModal: (cid)=>cid.startsWith("collab_modal_"),
  isAdmin,
};
