// DEV NOTE: LAUNCH-02 provider-agnostic commercial authority guard.
// Validates launch pricing, entitlement shape, server-authoritative hard caps
// and engine isolation. It does not connect a billing provider.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TOKEN = "PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY";
const root = process.cwd();
const canonical = "docs/releases/PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY.json";
const fixtures = "ci/fixtures/launch_02_commercial_pricing_entitlement_negative";
const FIELDS = ["product","account_role","tier","athlete_capacity","trial_state","trial_start_at","trial_end_at","intro_price_state","intro_period_start_at","intro_period_end_at","standard_price_gbp_minor","intro_price_gbp_minor","billing_state","access_state","founding_coach","founding_cohort_ordinal","billing_provider_ids","entitlement_metadata"];
const TIERS = [["coach_6",6,2499,1699],["coach_16",16,5999,3999],["coach_32",32,10999,7499],["coach_64",64,18999,12999],["coach_120",120,29999,19999],["coach_250",250,49999,32999]];

export const LAUNCH_02_REASON_CODES = Object.freeze({ PASS:"LAUNCH_02_PASS", AUTHORITY_REQUIRED:"LAUNCH_02_AUTHORITY_REQUIRED", PRICE_DRIFT:"LAUNCH_02_PRICE_DRIFT", COACH_TIER_DRIFT:"LAUNCH_02_COACH_TIER_DRIFT", FOUNDING_OFFER_DRIFT:"LAUNCH_02_FOUNDING_OFFER_DRIFT", FOUNDING_CLOCK_RESTART_FORBIDDEN:"LAUNCH_02_FOUNDING_CLOCK_RESTART_FORBIDDEN", ENTITLEMENT_FIELD_DRIFT:"LAUNCH_02_ENTITLEMENT_FIELD_DRIFT", ENTITLEMENT_INVALID:"LAUNCH_02_ENTITLEMENT_INVALID", CAPACITY_SOURCE_NOT_SERVER:"LAUNCH_02_CAPACITY_SOURCE_NOT_SERVER", CAPACITY_EXCEEDED:"LAUNCH_02_CAPACITY_EXCEEDED", SILENT_OVERFLOW_FORBIDDEN:"LAUNCH_02_SILENT_OVERFLOW_FORBIDDEN", SUBSCRIPTION_CONFLATION:"LAUNCH_02_SUBSCRIPTION_CONFLATION", ORG_TIER_FORBIDDEN:"LAUNCH_02_ORG_TIER_FORBIDDEN", STRIPE_CONNECTION_FORBIDDEN:"LAUNCH_02_STRIPE_CONNECTION_FORBIDDEN", CHECKOUT_IMPLEMENTATION_FORBIDDEN:"LAUNCH_02_CHECKOUT_IMPLEMENTATION_FORBIDDEN", ENGINE_COUPLING_FORBIDDEN:"LAUNCH_02_ENGINE_COUPLING_FORBIDDEN", SOURCE_AUTHORITY_DRIFT:"LAUNCH_02_SOURCE_AUTHORITY_DRIFT", DOC_DRIFT:"LAUNCH_02_DOC_DRIFT", POINTER_DRIFT:"LAUNCH_02_POINTER_DRIFT", NEGATIVE_FIXTURE_DRIFT:"LAUNCH_02_NEGATIVE_FIXTURE_DRIFT" });

const readJson = (p) => JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.resolve(root,p),"utf8"));
const readText = (p) => fs.readFileSync(path.resolve(root,p),"utf8");
const exactSet = (a,b) => Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&[...a].sort().every((v,i)=>v===[...b].sort()[i]);
const result = (ok,reason_code,details={}) => Object.freeze({ok,reason_code,details:Object.freeze({...details})});
const tierMap = (a) => new Map((a.products?.coach?.tiers??[]).map((t)=>[t.tier,t]));

export function validateLaunchEntitlementRecord(a,r){
  if(!a||typeof a!=="object"||!r||typeof r!=="object"||Array.isArray(r)) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID);
  if(!exactSet(Object.keys(r),a.entitlement_record?.exact_fields??[])) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_FIELD_DRIFT);
  for(const f of ["trial_state","intro_price_state","billing_state","access_state"]) if(!(a.state_vocabulary?.[f]??[]).includes(r[f])) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID,{field:f});
  if(!r.billing_provider_ids||typeof r.billing_provider_ids!=="object"||Array.isArray(r.billing_provider_ids)||!r.entitlement_metadata||typeof r.entitlement_metadata!=="object"||Array.isArray(r.entitlement_metadata)) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID);
  if(r.account_role==="athlete"){
    const p=a.products?.athlete_individual;
    if(r.product!==p?.product||r.tier!==p?.tier||r.athlete_capacity!==null||r.standard_price_gbp_minor!==p?.standard_price_gbp_minor||r.intro_price_gbp_minor!==null||r.founding_coach!==false||r.founding_cohort_ordinal!==null) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID,{role:"athlete"});
    return result(true,LAUNCH_02_REASON_CODES.PASS);
  }
  if(r.account_role==="coach"){
    const t=tierMap(a).get(r.tier);
    if(r.product!==a.products?.coach?.product||!t||r.athlete_capacity!==t.athlete_capacity||r.standard_price_gbp_minor!==t.standard_price_gbp_minor||r.intro_price_gbp_minor!==t.intro_price_gbp_minor) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID,{role:"coach",tier:r.tier});
    if(r.founding_coach===true){ const lim=a.founding_coach_offer?.cohort?.active_limit; if(!Number.isInteger(r.founding_cohort_ordinal)||r.founding_cohort_ordinal<1||r.founding_cohort_ordinal>lim) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID,{field:"founding_cohort_ordinal"}); }
    else if(r.founding_cohort_ordinal!==null) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID,{field:"founding_cohort_ordinal"});
    return result(true,LAUNCH_02_REASON_CODES.PASS);
  }
  return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID,{field:"account_role"});
}

export function evaluateCoachCapacity(a,{entitlement,occupied_athlete_count,requested_additional_athletes,count_source}){
  const v=validateLaunchEntitlementRecord(a,entitlement); if(!v.ok||entitlement.account_role!=="coach") return v;
  if(count_source!==a.capacity_policy?.occupied_athlete_count_source||a.capacity_policy?.server_authoritative!==true) return result(false,LAUNCH_02_REASON_CODES.CAPACITY_SOURCE_NOT_SERVER);
  if(!Number.isInteger(occupied_athlete_count)||occupied_athlete_count<0||!Number.isInteger(requested_additional_athletes)||requested_additional_athletes<=0) return result(false,LAUNCH_02_REASON_CODES.ENTITLEMENT_INVALID);
  const total=occupied_athlete_count+requested_additional_athletes;
  if(total>entitlement.athlete_capacity) return result(false,LAUNCH_02_REASON_CODES.CAPACITY_EXCEEDED,{athlete_capacity:entitlement.athlete_capacity,occupied_athlete_count,requested_additional_athletes,requested_total:total,product_access_state:"rejected",engine_decision:false});
  return result(true,LAUNCH_02_REASON_CODES.PASS,{athlete_capacity:entitlement.athlete_capacity,available_after:entitlement.athlete_capacity-total,product_access_state:"allowed",engine_decision:false});
}

export function applyFoundingCoachTierUpgrade(a,r,targetTier){
  const v=validateLaunchEntitlementRecord(a,r); if(!v.ok||r.account_role!=="coach"||r.founding_coach!==true) return v;
  const t=tierMap(a).get(targetTier); if(!t) return result(false,LAUNCH_02_REASON_CODES.COACH_TIER_DRIFT);
  const upgraded=Object.freeze({...r,tier:t.tier,athlete_capacity:t.athlete_capacity,standard_price_gbp_minor:t.standard_price_gbp_minor,intro_price_gbp_minor:t.intro_price_gbp_minor});
  return Object.freeze({ok:true,reason_code:LAUNCH_02_REASON_CODES.PASS,record:upgraded,intro_clock_preserved:upgraded.intro_period_start_at===r.intro_period_start_at&&upgraded.intro_period_end_at===r.intro_period_end_at});
}

function fail(code,detail=""){ console.error(`${TOKEN}: FAIL ${code}${detail?`: ${detail}`:""}`); process.exitCode=1; }
function validateAuthority(a,{checkDocs=true}={}){
  if(a.schema_version!=="LAUNCH-02.1.0.0"||a.slice_id!=="LAUNCH-02") fail(LAUNCH_02_REASON_CODES.AUTHORITY_REQUIRED);
  if(a.release?.release_id!=="kolosseum_public_launch"||a.release?.release_authority!=="LAUNCH-00"||a.release?.surface_authority!=="LAUNCH-01"||a.release?.public_launch_authorised!==false||a.release?.final_acceptance_gate!=="LAUNCH-10") fail(LAUNCH_02_REASON_CODES.SOURCE_AUTHORITY_DRIFT);
  const athlete=a.products?.athlete_individual; if(athlete?.product!=="athlete_individual"||athlete?.account_role!=="athlete"||athlete?.tier!=="athlete_monthly"||athlete?.athlete_capacity!==null||athlete?.standard_price_gbp_minor!==1499) fail(LAUNCH_02_REASON_CODES.PRICE_DRIFT,"athlete_individual");
  const tiers=a.products?.coach?.tiers??[]; if(a.products?.coach?.product!=="coach_subscription"||a.products?.coach?.account_role!=="coach"||tiers.length!==TIERS.length) fail(LAUNCH_02_REASON_CODES.COACH_TIER_DRIFT);
  for(const [id,cap,std,intro] of TIERS){ const t=tiers.find((x)=>x.tier===id); if(!t||t.athlete_capacity!==cap||t.standard_price_gbp_minor!==std||t.intro_price_gbp_minor!==intro) fail(LAUNCH_02_REASON_CODES.COACH_TIER_DRIFT,id); }
  if(tiers.some((t)=>/org|team|gym|enterprise/u.test(String(t.tier)))) fail(LAUNCH_02_REASON_CODES.ORG_TIER_FORBIDDEN);
  const o=a.founding_coach_offer??{}; if(o.enabled!==true||o.trial_days!==30||o.card_required_during_trial!==false||o.intro_paid_months!==6||o.automatic_transition_to_standard_price!==true) fail(LAUNCH_02_REASON_CODES.FOUNDING_OFFER_DRIFT);
  if(o.upgrade_preserves_intro_period_start!==true||o.upgrade_preserves_intro_period_end!==true||o.upgrade_does_not_restart_intro_clock!==true) fail(LAUNCH_02_REASON_CODES.FOUNDING_CLOCK_RESTART_FORBIDDEN);
  if(o.cohort?.initial_limit!==100||o.cohort?.active_limit!==100||o.cohort?.maximum_authorised_limit!==250||o.cohort?.expansion_requires_explicit_authority_update!==true) fail(LAUNCH_02_REASON_CODES.FOUNDING_OFFER_DRIFT,"cohort");
  if(!exactSet(a.entitlement_record?.exact_fields??[],FIELDS)) fail(LAUNCH_02_REASON_CODES.ENTITLEMENT_FIELD_DRIFT);
  if(a.capacity_policy?.server_authoritative!==true||a.capacity_policy?.occupied_athlete_count_source!=="server_relationship_state") fail(LAUNCH_02_REASON_CODES.CAPACITY_SOURCE_NOT_SERVER);
  if(a.capacity_policy?.hard_cap!==true||a.capacity_policy?.silent_overflow!==false) fail(LAUNCH_02_REASON_CODES.SILENT_OVERFLOW_FORBIDDEN);
  if(a.commercial_separation?.athlete_and_coach_subscriptions_are_separate!==true||a.commercial_separation?.coach_payment_satisfies_athlete_personal_subscription!==false||a.commercial_separation?.athlete_payment_satisfies_coach_subscription!==false) fail(LAUNCH_02_REASON_CODES.SUBSCRIPTION_CONFLATION);
  if(a.provider_boundary?.stripe_connection_authorised_by_launch_02!==false) fail(LAUNCH_02_REASON_CODES.STRIPE_CONNECTION_FORBIDDEN);
  if(a.provider_boundary?.checkout_implementation_authorised_by_launch_02!==false) fail(LAUNCH_02_REASON_CODES.CHECKOUT_IMPLEMENTATION_FORBIDDEN);
  if(a.legacy_controlled_launch?.organisation_team_gym_enterprise_tiers_authorised!==false||a.legacy_controlled_launch?.controlled_launch_org_seat_scope_is_public_launch_authority!==false) fail(LAUNCH_02_REASON_CODES.ORG_TIER_FORBIDDEN);
  for(const [k,v] of Object.entries(a.engine_truth_invariants??{})) if(v!==false) fail(LAUNCH_02_REASON_CODES.ENGINE_COUPLING_FORBIDDEN,k);
  if(checkDocs){
    const l0=readJson("docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.json"), l1=readJson("docs/releases/PUBLIC_LAUNCH_SURFACE_MANIFEST.json");
    if(l0.release?.release_id!==a.release?.release_id||l1.release?.release_id!==a.release?.release_id||!(l1.commercial_policy?.required_activation_gates??[]).includes("LAUNCH-02")) fail(LAUNCH_02_REASON_CODES.SOURCE_AUTHORITY_DRIFT);
    const md=readText("docs/releases/PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY.md"); for(const token of ["£14.99/month","£24.99/month","£59.99/month","£109.99/month","£189.99/month","£299.99/month","£499.99/month","£16.99/month","£39.99/month","£74.99/month","£129.99/month","£199.99/month","£329.99/month","30 days free","six paid months","LAUNCH-04","LAUNCH-10"]) if(!md.includes(token)) fail(LAUNCH_02_REASON_CODES.DOC_DRIFT,token);
    const pointer=readText("docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md"); if(!pointer.includes(canonical)||!pointer.includes("PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY: PASS")) fail(LAUNCH_02_REASON_CODES.POINTER_DRIFT);
    for(const name of ["commercial_engine_effect.json","founding_upgrade_restarts_clock.json","organisation_tier_injected.json","silent_capacity_overflow.json","stripe_connection_enabled.json","subscription_conflation.json"]){ const f=readJson(path.join(fixtures,name)); if(f.slice_id!=="LAUNCH-02"||!f.case_id||!f.expected_token||!f.mutation?.path) fail(LAUNCH_02_REASON_CODES.NEGATIVE_FIXTURE_DRIFT,name); }
  }
}
function main(){ const i=process.argv.indexOf("--authority"), arg=i>=0?process.argv[i+1]:canonical; if(!arg){fail(LAUNCH_02_REASON_CODES.AUTHORITY_REQUIRED);return;} let a; try{a=readJson(arg);}catch(e){fail(LAUNCH_02_REASON_CODES.AUTHORITY_REQUIRED,String(e?.message??e));return;} validateAuthority(a,{checkDocs:path.resolve(arg)===path.resolve(root,canonical)}); if(!process.exitCode) console.log(`${TOKEN}: PASS`); }
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) main();
