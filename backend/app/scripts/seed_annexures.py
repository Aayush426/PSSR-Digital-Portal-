"""Seed the refinery PSSR annexure engine with controlled checklist content."""

import html
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path

from app.database import Base, SessionLocal, engine
from app.models.annexures import (
    Annexure,
    AnnexureAssignment,
    AnnexureDepartment,
    AnnexurePunchPoint,
    AnnexureQuestion,
    AnnexureResponse,
    AnnexureSection,
    AnnexureTemplate,
)
from app.models.user import User, UserRole


Base.metadata.create_all(bind=engine)

DEPARTMENTS = [
    "Safety",
    "PM Operation",
    "Process",
    "Mechanical",
    "Inspection",
    "Civil",
    "Electrical",
    "Instrumental",
    "Fire",
    "IT",
]

ANNEXURE_SPECS = [
    (1, "Document Review", ["Safety", "Process", "Inspection"], "PSSR dossier completeness, approvals, drawings, and statutory records"),
    (2, "Personnel Safety", ["Safety", "PM Operation", "Fire"], "PPE, access control, evacuation readiness, and operator protection"),
    (3, "HSE Hardware", ["Safety", "Fire", "Mechanical"], "Safety showers, eyewash, guards, barricades, and fixed HSE equipment"),
    (4, "Fire Protection", ["Fire", "Safety", "Mechanical"], "Fire water systems, hydrants, monitors, extinguishers, and foam readiness"),
    (5, "F&G and Communication Systems", ["Instrumental", "Fire", "IT"], "Gas detection, fire detection, alarms, PA, telecom, and control-room alerts"),
    (6, "Instrumentation & Control Systems", ["Instrumental", "Process", "IT"], "DCS, PLC, ESD, interlocks, calibration, and loop validation"),
    (7, "Buildings & Surroundings", ["Civil", "Safety", "PM Operation"], "Building integrity, escape routes, roads, housekeeping, and drainage"),
    (8, "Piping", ["Mechanical", "Inspection", "Process"], "Line reinstatement, pressure testing, supports, blinds, and leak integrity"),
    (9, "Storage Tanks", ["Inspection", "Mechanical", "Fire"], "Tank inspection, vents, bunds, foam systems, earthing, and drains"),
    (10, "Horton Spheres/Bullets", ["Inspection", "Mechanical", "Safety"], "Pressure storage vessel integrity, relief systems, and isolation readiness"),
    (11, "Process Vessels", ["Inspection", "Process", "Mechanical"], "Vessel internals, manways, relief devices, and operating safeguards"),
    (12, "Heat Exchangers", ["Mechanical", "Inspection", "Process"], "Tube bundle integrity, isolation, hydrotest, and thermal expansion checks"),
    (13, "Boilers Furnaces & Heaters", ["Mechanical", "Process", "Safety"], "Burner management, refractory, purging, draft, and fuel safety"),
    (14, "Pumps", ["Mechanical", "Electrical", "PM Operation"], "Pump alignment, seals, lube systems, rotation, and protection trips"),
    (15, "Compressors", ["Mechanical", "Instrumental", "Electrical"], "Compressor trains, surge controls, vibration, lube oil, and permissives"),
    (16, "Electrical Substation", ["Electrical", "Safety", "Instrumental"], "Switchgear, protection relays, earthing, UPS, and energization controls"),
    (17, "Satellite Buildings", ["Civil", "Electrical", "IT"], "Remote building utilities, telecom, fire detection, HVAC, and access readiness"),
    (18, "PSSR Punch List", ["Safety", "PM Operation", "Inspection"], "Category A/B/C punch capture, ownership, due dates, and closeout"),
    (19, "OISD Based PSSR Report", ["Safety", "Process", "Inspection"], "OISD-aligned report checks, compliance gaps, and approval trail"),
    (20, "Concession Deviation", ["Process", "Safety", "Inspection"], "Temporary deviations, risk acceptance, compensating controls, and expiry"),
    (21, "Conveyor System", ["Mechanical", "Electrical", "Safety"], "Conveyor guarding, pull cords, drives, interlocks, and housekeeping"),
    (22, "Unit Start-up Checklist", ["PM Operation", "Process", "Safety"], "Line-up, utilities, permits, communication, and startup authorization"),
    (23, "Fixed Grating Structure", ["Civil", "Safety", "Inspection"], "Grating integrity, clamps, openings, handrails, and load safety"),
    (24, "Authority to Proceed (ATP)", ["PM Operation", "Safety", "Process"], "Final authorization, signatures, residual risk acceptance, and handover"),
    (25, "Electrical Instrument Related Changes", ["Electrical", "Instrumental", "IT"], "Electrical and instrument MOC changes, loop updates, panels, and backups"),
]

SECTION_DEFINITIONS = [
    ("Document Checkpoints", "DOCUMENT", "Approved records, certificates, drawings, test packs, and statutory evidence."),
    ("Field Checkpoints", "FIELD", "Physical verification of installed equipment, access, safeguards, and readiness."),
    ("Workflow & Closure", "CUSTOM", "Ownership, punch closeout, review trail, evidence upload, and startup authorization."),
]

ANNEXURE_QUESTION_BANK = {
    1: {
        "DOCUMENT": ["Approved PSSR dossier index includes MOC references, marked-up P&IDs, plot plans, cause and effect charts, and commissioning dossiers.", "Latest IFC/as-built P&IDs are reconciled against field redlines and stale drawings are withdrawn.", "Line list, equipment list, PSV list, and critical instrument list are cross-referenced to the annexure package.", "Document holds and reviewer comments are logged with accountable discipline owners."],
        "FIELD": ["Field tags for lines, valves, instruments, and equipment match the approved drawing set.", "Temporary blinds, spades, spectacle blinds, and jumpers are identified against the approved isolation register.", "Battery limit tie-ins are physically verified against the MOC and construction completion certificate.", "Documented punch items are visible in the field with owner, category, and startup impact."],
        "CUSTOM": ["Document controller confirms the final revision pack is locked for startup review.", "Process, Inspection, and Safety reviewers sign the controlled document readiness statement.", "Residual document gaps have approved concession references and expiry dates.", "Startup authority has access to the current annexure template and revision notes."],
    },
    2: {
        "DOCUMENT": ["PPE matrix is approved for startup hazards including chemical exposure, noise, heat, and working-at-height scenarios.", "Personnel access plan includes muster points, controlled entry zones, and visitor restrictions.", "Training records for operating crew, maintenance standby, and emergency responders are current.", "SOP/JSA references for first startup activities are listed with revision control."],
        "FIELD": ["Emergency exits, escape routes, wind socks, and muster point signages are unobstructed and illuminated.", "Portable gas monitors, breathing apparatus, safety showers, and eyewash stations are available where required.", "Barricades and exclusion zones are installed around pressurized, hot, rotating, and energized equipment.", "Shift communication points and permit boards are ready for startup control."],
        "CUSTOM": ["Safety representative verifies personnel readiness before shift handover.", "Operations confirms minimum staffing and standby coverage for startup window.", "Critical personnel safety gaps are elevated as Category A punch points.", "Area owner accepts residual personnel risk only through documented approval."],
    },
    3: {
        "DOCUMENT": ["HSE hardware list identifies safety showers, eyewash, guards, barricades, lifting points, and access protections.", "Inspection certificates are available for installed fixed safety equipment.", "Safety critical equipment maintenance plans are mapped to the asset register.", "Deviation records exist for unavailable HSE hardware with compensating controls."],
        "FIELD": ["Machine guards, handrails, toe boards, ladder cages, and fixed platforms are installed and secure.", "Safety showers and eyewash stations have flow, access, lighting, and drain verification.", "Temporary barricades and warning signages are fit for startup hazards.", "Housekeeping around HSE hardware allows quick emergency access."],
        "CUSTOM": ["Safety and Mechanical jointly accept hardware readiness.", "Unavailable HSE hardware is tracked with startup impact and owner.", "Required photographs and inspection tags are attached to master records.", "Open HSE hardware actions are blocked from administrative closure until categorized."],
    },
    4: {
        "DOCUMENT": ["Firewater network drawings, hydraulic adequacy notes, and hydrant/monitor coverage maps are current.", "Foam, deluge, sprinkler, and water spray system test certificates are uploaded.", "Extinguisher placement chart and inspection register match the startup area.", "Fire alarm interface matrix includes control room annunciation and emergency response contacts."],
        "FIELD": ["Hydrants, monitors, hose boxes, and isolation valves are accessible, tagged, and leak-free.", "Deluge valves, spray nozzles, strainers, and drains are lined up and tested.", "Portable extinguishers are correct type, charged, sealed, and visible.", "Firewater pumps, jockey pump, diesel backup, and power supply status are confirmed."],
        "CUSTOM": ["Fire department confirms response readiness and coverage acceptance.", "Failed fire protection tests are classified before startup authorization.", "Firewater impairments have formal permit, duration, and compensating controls.", "Approval block includes Fire, Safety, and Operations sign-off."],
    },
    5: {
        "DOCUMENT": ["Gas detector, flame detector, MCP, hooter, beacon, PA, and radio coverage drawings are current.", "F&G cause and effect matrix is approved and mapped to DCS/ESD annunciation.", "Calibration certificates for detectors and alarm devices are available.", "Telecom and emergency communication test procedure is approved."],
        "FIELD": ["Gas and flame detectors are installed at approved elevation, orientation, and tag location.", "Alarm hooters, beacons, PA speakers, and manual call points are audible/visible in the area.", "Detector bump tests and alarm voting checks are completed.", "Control room, field radio, telephone, and emergency channel communication is verified."],
        "CUSTOM": ["Instrumental and Fire jointly accept F&G readiness.", "Alarm bypasses/inhibits are listed with authorization and expiry.", "Communication dead zones are logged with interim controls.", "Startup cannot proceed with unresolved critical F&G detection gaps."],
    },
    6: {
        "DOCUMENT": ["DCS graphics, PLC logic, SIS cause and effect, alarm philosophy, and loop folders are revision controlled.", "Instrument index, IO list, and calibration records are reconciled with commissioned loops.", "SIS validation and proof test records are approved for startup service.", "Cyber/backup records for control system changes are stored with rollback plan."],
        "FIELD": ["Transmitters, control valves, analyzers, solenoids, and junction boxes are installed and tagged correctly.", "Loop checks, stroke tests, alarm setpoints, and permissive/interlock tests are complete.", "DCS/PLC/SIS cabinets have healthy power, earthing, ventilation, and no forced conditions.", "Critical alarms and trips are demonstrated from field input to operator console."],
        "CUSTOM": ["Instrumental owner confirms no unauthorized bypasses remain active.", "Process owner accepts alarm rationalization and operating setpoints.", "IT/control systems confirms backup, access control, and time sync.", "SIS validation exceptions are recorded as startup-blocking unless approved by authority."],
    },
    7: {
        "DOCUMENT": ["Civil completion certificates cover buildings, roads, drains, shelters, doors, windows, and structural repairs.", "Occupancy and emergency egress layouts are approved for the startup area.", "HVAC and ventilation test reports are available for occupied buildings.", "Drainage and housekeeping acceptance records are linked to the annexure."],
        "FIELD": ["Access roads, walkways, stairs, doors, and emergency exits are clear and serviceable.", "Buildings have lighting, ventilation, drainage, and safe electrical fittings.", "Surrounding area is free of debris, trip hazards, water logging, and loose materials.", "Boundary fencing, gates, signage, and vehicle control points are ready."],
        "CUSTOM": ["Civil and Operations jointly accept building readiness.", "Temporary civil works have owner, inspection frequency, and removal plan.", "Housekeeping punch list is closed or categorized.", "Area owner records final surroundings acceptance before startup."],
    },
    8: {
        "DOCUMENT": ["Piping test packs, line history sheets, NDT reports, hydrotest/pneumatic test records, and flushing records are complete.", "Blind list, spectacle blind status, gasket/bolt specs, and reinstatement checklist are approved.", "P&ID line-up and valve status sheets are issued for startup.", "Pressure relief and thermal expansion review for piping circuits is documented."],
        "FIELD": ["Piping supports, spring hangers, guides, anchors, and shoes are installed per drawings.", "Flanges, gaskets, bolts, drains, vents, and small-bore connections are reinstated and leak-ready.", "Blinds/spades are positioned as per approved startup line-up.", "Hot, cold, vibrating, and hazardous lines have insulation, guards, labels, and access clearance."],
        "CUSTOM": ["Mechanical, Inspection, and Process accept piping integrity.", "Leak test exceptions have approved concession and monitoring plan.", "Critical line-up steps are assigned to operations owner.", "Startup authorization references the final signed piping reinstatement package."],
    },
    9: {
        "DOCUMENT": ["Tank inspection reports, calibration chart, roof/seal records, settlement data, and repair history are available.", "Vent, breather valve, flame arrester, foam chamber, and rim seal fire protection certificates are current.", "Bund wall capacity, drain valve policy, and oily water routing documents are approved.", "Tank earthing/lightning protection test records are attached."],
        "FIELD": ["Tank shell, roof, nozzles, manways, stairs, platforms, gauges, and valves are physically verified.", "Bund area is clean, drain valves are positioned correctly, and no unauthorized openings exist.", "Foam pourers, cooling rings, hydrants, and access paths are ready.", "Level gauges, alarms, radar/servo instruments, and overfill protection are tested."],
        "CUSTOM": ["Inspection owner signs tank integrity acceptance.", "Fire owner signs tank fire protection readiness.", "Product introduction limitations and filling rate restrictions are documented.", "Open tank defects are categorized by startup impact."],
    },
    10: {
        "DOCUMENT": ["Pressure vessel inspection certificate, hydrotest record, thickness data, and statutory approvals are available.", "PSV, rupture disc, ESD valve, and isolation valve records are current.", "Bullet/sphere operating envelope and startup procedure are approved.", "Cathodic protection, earthing, and fireproofing inspection records are attached."],
        "FIELD": ["Sphere/bullet supports, saddles, foundations, fireproofing, stairs, and platforms are intact.", "PSVs, isolation valves, drains, vents, sample points, and gauges are tagged and lined up.", "Remote operated valves and ESD closure tests are completed.", "Firewater cooling, monitors, and gas detection around pressure storage are available."],
        "CUSTOM": ["Inspection and Mechanical accept pressure storage integrity.", "Safety accepts emergency isolation and fire protection readiness.", "Filling and pressurization limits are recorded for startup.", "Any statutory concession is approved before service introduction."],
    },
    11: {
        "DOCUMENT": ["Vessel internal inspection, closure certificate, tray/packing/demister records, and manway box-up checklist are complete.", "PSV sizing/reference documents and relief path verification are available.", "Nozzle orientation, connected line list, and isolation plan are approved.", "Operating procedure includes startup pressurization and inerting requirements."],
        "FIELD": ["Manways, nozzles, internals, blinds, supports, insulation, and nameplate are verified.", "Level instruments, pressure gauges, temperature elements, and alarms are installed and functional.", "Drains, vents, sample points, and relief devices are correctly oriented and accessible.", "Vessel is clean, boxed up, leak-ready, and free from temporary materials."],
        "CUSTOM": ["Process and Inspection accept vessel readiness.", "Internal-entry closeout evidence is attached.", "Open vessel punch points identify startup blocking status.", "Area owner approves vessel handover to operations."],
    },
    12: {
        "DOCUMENT": ["Heat exchanger hydrotest, leak test, bundle inspection, gasket, bolt, and box-up records are complete.", "Thermal expansion, bypass, isolation, and relief review is documented.", "Cleaning/flushing certificates are attached for both shell and tube sides.", "Startup procedure defines warm-up/cool-down and differential pressure limits."],
        "FIELD": ["Channel covers, bonnets, nozzles, supports, expansion joints, and nameplates are checked.", "Shell/tube side drains, vents, bypasses, and isolation valves are lined up.", "Temperature, pressure, and differential pressure instruments are calibrated.", "Insulation, cladding, access platforms, and hot surface protection are ready."],
        "CUSTOM": ["Mechanical accepts exchanger mechanical integrity.", "Process accepts startup thermal constraints.", "Inspection records any tube plugging or concession limits.", "Operations records monitoring requirements for first service."],
    },
    13: {
        "DOCUMENT": ["Burner management system cause and effect, purge procedure, refractory dry-out, and fuel gas certificates are approved.", "Stack, draft, FD/ID fan, flame scanner, and trip test records are available.", "Fuel oil/gas train leak tests and safety valve checks are complete.", "Operating envelope includes light-up, purge, and emergency shutdown criteria."],
        "FIELD": ["Burners, pilots, igniters, flame scanners, peepholes, dampers, and registers are installed and clean.", "BMS purge permissives, flame failure trip, low fuel pressure trip, and fan interlocks are demonstrated.", "Refractory, casing, expansion joints, doors, and explosion panels are inspected.", "Fuel lines, drains, vents, and nitrogen/steam purging utilities are ready."],
        "CUSTOM": ["Process, Mechanical, and Safety approve heater light-up readiness.", "Any bypassed BMS input is documented and approved.", "Fire watch and emergency response arrangements are recorded.", "Startup authorization references signed burner management validation."],
    },
    14: {
        "DOCUMENT": ["Pump data sheet, alignment report, solo run report, seal plan, lube oil record, and motor test certificate are available.", "Pump protection trip settings and permissives are approved.", "Suction/discharge piping reinstatement and flushing records are complete.", "Startup procedure includes priming, minimum flow, and rotation checks."],
        "FIELD": ["Pump, motor, coupling guard, baseplate, grouting, foundation bolts, and earthing are verified.", "Suction strainer, minimum flow line, seal system, cooling water, and lube oil are ready.", "Rotation, vibration, bearing temperature, and mechanical seal checks are complete.", "Local start/stop, ESD, pressure switches, and motor protection are tested."],
        "CUSTOM": ["Mechanical and Electrical accept pump train readiness.", "Operations confirms line-up, priming, and standby pump strategy.", "Seal or vibration concerns are categorized before startup.", "First run monitoring owner and acceptance limits are recorded."],
    },
    15: {
        "DOCUMENT": ["Compressor mechanical run, lube oil flushing, seal gas, surge control, vibration, and trip test records are complete.", "Vendor startup procedure and operating envelope are approved.", "Motor/turbine driver certificates and coupling alignment report are attached.", "Alarm/trip setpoints and antisurge tuning records are reviewed."],
        "FIELD": ["Compressor casing, driver, coupling, guards, lube oil skid, seal system, and coolers are installed correctly.", "Lube oil, seal gas, cooling water, drains, vents, and nitrogen utilities are lined up.", "Vibration probes, speed pickups, thrust/bearing temperature, and surge instruments are tested.", "ESD, recycle valve, antisurge valve, permissives, and emergency shutdown are demonstrated."],
        "CUSTOM": ["Mechanical, Instrumental, and Electrical accept compressor readiness.", "Vendor or specialist acceptance is recorded where required.", "Startup monitoring plan includes vibration, temperature, pressure, and surge margin.", "Critical compressor exceptions are blocked without authority approval."],
    },
    16: {
        "DOCUMENT": ["Switchgear, transformer, relay setting, cable test, megger, and energization permit records are complete.", "SLD, protection coordination, earthing layout, and arc-flash labels are current.", "UPS/battery charger and emergency power test reports are available.", "LOTO and electrical energization procedure is approved."],
        "FIELD": ["Switchgear panels, transformers, MCCs, cables, glands, labels, and earthing are inspected.", "Protection relays, interlocks, breakers, meters, and annunciation are tested.", "UPS, battery bank, emergency lighting, and critical feeders are healthy.", "Electrical rooms have HVAC, access control, rubber mats, fire detection, and housekeeping."],
        "CUSTOM": ["Electrical owner authorizes energization readiness.", "Safety confirms electrical hazard controls and access restrictions.", "Open electrical defects identify startup impact.", "Final energization approval is retained in revision history."],
    },
    17: {
        "DOCUMENT": ["Satellite building utility, HVAC, telecom, fire detection, and access control documents are available.", "Civil and electrical completion certificates are signed.", "Remote panel/vendor system manuals and backup records are attached.", "Occupancy readiness checklist is approved."],
        "FIELD": ["Remote building structure, doors, windows, HVAC, lighting, and drainage are serviceable.", "Telecom, network, CCTV, access control, and fire detection systems are functional.", "Electrical panels, UPS, earthing, and cable penetrations are safe.", "Escape routes, signage, extinguishers, and housekeeping are verified."],
        "CUSTOM": ["Civil, Electrical, and IT accept remote building readiness.", "Building access ownership and emergency contact list are recorded.", "Any temporary utility supply is controlled and time-bound.", "Area owner approves occupancy before startup support use."],
    },
    18: {
        "DOCUMENT": ["Punch list register includes category, owner, due date, startup impact, and closure evidence fields.", "Category A/B/C definitions and escalation matrix are approved.", "Previous review comments are migrated into the controlled punch list.", "Punch closure authority and verification requirements are documented."],
        "FIELD": ["Sampled punch points are physically traceable to tags, equipment, or location markers.", "Category A items are isolated from startup closure until verified.", "Field evidence for closed punch points is available and credible.", "Temporary repairs or concessions are labelled and controlled."],
        "CUSTOM": ["Discipline owners acknowledge assigned punch points.", "Area owner reviews residual Category B/C items before ATP.", "Punch aging and overdue items are visible in master metadata.", "Audit trail records all reopen, close, and reclassify decisions."],
    },
    19: {
        "DOCUMENT": ["OISD checklist clauses applicable to the unit are mapped to annexure sections.", "Compliance gaps, exemptions, and references to site standards are documented.", "Final PSSR report format includes observations, recommendations, and approval trail.", "Regulatory and statutory attachments are linked in the master template."],
        "FIELD": ["Field sample verification supports the OISD compliance statements.", "Safety critical equipment listed in the OISD matrix is installed and accessible.", "Emergency response provisions satisfy applicable OISD requirements.", "Observed deviations are captured as punch points with risk classification."],
        "CUSTOM": ["Safety owner signs OISD compliance preview.", "Process and Inspection acknowledge clause-level evidence.", "Unresolved OISD gaps are escalated before ATP.", "Report revision history is preserved with reviewer comments."],
    },
    20: {
        "DOCUMENT": ["Concession/deviation request includes technical basis, risk assessment, affected safeguards, and expiry date.", "Approvals from Process, Safety, Inspection, and competent authority are attached.", "Compensating controls and operating restrictions are documented.", "Deviation register references linked MOC, punch, and ATP records."],
        "FIELD": ["Field condition matches the approved deviation scope and no extra deviation exists.", "Temporary controls, tags, barriers, monitoring points, and signage are installed.", "Operators can identify the deviation and associated operating limits.", "Expiry or removal requirement is visible at the affected location."],
        "CUSTOM": ["Deviation owner accepts monitoring and closure obligations.", "Safety accepts compensating controls before startup.", "Expired or unapproved deviations are flagged as startup blockers.", "Revision notes capture deviation extension, closure, or conversion to permanent MOC."],
    },
    21: {
        "DOCUMENT": ["Conveyor GA, belt specification, drive datasheets, guarding layout, and pull cord route are approved.", "Belt alignment, no-load trial, motor test, and interlock records are available.", "Emergency stop, zero speed switch, belt sway, chute block, and pull cord test sheets are attached.", "Housekeeping and material spillage control procedure is available."],
        "FIELD": ["Conveyor belt alignment, tracking, tension, idlers, pulleys, skirting, and scrapers are verified.", "Belt guards, nip guards, walkways, handrails, and emergency access are installed.", "Pull cords, E-stops, belt sway switches, zero speed switches, and chute blockage switches are tested.", "Drive, gearbox, coupling, motor, earthing, and local controls are ready."],
        "CUSTOM": ["Mechanical, Electrical, and Safety accept conveyor startup readiness.", "Operator confirms pull cord reset and restart procedure.", "Spillage or guarding defects are categorized before energization.", "Startup monitoring includes belt tracking, noise, vibration, and temperature."],
    },
    22: {
        "DOCUMENT": ["Unit startup procedure, line-up checklist, utility readiness matrix, and permit strategy are approved.", "Operating limits, critical alarms, trip setpoints, and emergency shutdown criteria are listed.", "Communication plan covers control room, field operators, maintenance, safety, and area owner.", "Feed/product routing, flare, drain, steam, nitrogen, air, power, and cooling water dependencies are mapped."],
        "FIELD": ["Utilities are available at required pressure, quality, flow, and reliability.", "Unit line-up, valves, drains, vents, blinds, and sample points match startup procedure.", "Control room graphics, log sheets, radios, and field operator stations are ready.", "Emergency response, firewater, spill control, and evacuation readiness are confirmed."],
        "CUSTOM": ["PM Operation confirms shift readiness and startup command structure.", "Process approves feed introduction criteria.", "Safety accepts residual startup risk controls.", "Authority to start records time, approvers, and startup hold points."],
    },
    23: {
        "DOCUMENT": ["Grating layout, structural inspection report, repair record, and load rating references are available.", "Missing grating/opening register and barricade plan are approved.", "Handrail, toe board, clamp, and fixing inspection records are attached.", "Temporary platform or scaffold concessions are documented."],
        "FIELD": ["Gratings are seated, clamped, corrosion-free, and without hazardous openings.", "Handrails, toe boards, kick plates, stair treads, and ladder access are secure.", "Load-sensitive areas are marked and free from unauthorized storage.", "Temporary covers and barricades are robust, labelled, and controlled."],
        "CUSTOM": ["Civil and Safety accept access structure readiness.", "Open grating defects are classified for startup impact.", "Photographic evidence is attached for repaired/open areas.", "Area owner acknowledges any temporary access restriction."],
    },
    24: {
        "DOCUMENT": ["ATP form references completed annexures, open punch categories, deviations, and final risk acceptance.", "Approver list includes Operations, Safety, Process, Inspection, Maintenance, and Area Owner as applicable.", "Startup hold points and conditions precedent are documented.", "Residual risk statement and validity period are defined."],
        "FIELD": ["Final field walkdown confirms no unauthorized work, temporary materials, or uncontrolled hazards remain.", "Critical utilities, safeguards, alarms, fire protection, and communication are available.", "Startup boundary and operating control room are ready for command handover.", "Open Category B/C items have visible controls and agreed monitoring."],
        "CUSTOM": ["All mandatory signatories approve ATP with timestamp and remarks.", "Category A punch points are verified closed before ATP issue.", "ATP revision captures any revalidation after scope change or delay.", "Operations receives formal handover package for startup."],
    },
    25: {
        "DOCUMENT": ["Electrical/instrument MOC change list includes panels, loops, IO, cables, JB changes, logic, and backups.", "Updated loop drawings, cable schedules, termination diagrams, and panel drawings are uploaded.", "DCS/PLC/SIS backup, version notes, and rollback method are documented.", "Cyber/access control review is complete for changed systems."],
        "FIELD": ["Changed cables, glands, terminations, panels, marshalling, and earthing are inspected.", "Instrument loops, alarms, trips, interlocks, and control narratives are tested after modification.", "Panel labels, ferrules, loop tags, and field instrument tags match updated drawings.", "Network, historian, printer, and operator console impacts are checked."],
        "CUSTOM": ["Electrical, Instrumental, and IT accept modified system readiness.", "Rollback and backup owner is named before startup.", "Unverified EI changes are captured as startup blockers.", "Revision notes include exact change package and commissioning evidence."],
    },
}


def seed_annexures() -> None:
    """Create annexure master template data without execution responses."""

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == UserRole.ADMIN.value).order_by(User.id.asc()).first()
        created = 0

        for number, title, departments, description in ANNEXURE_SPECS:
            annexure = db.query(Annexure).filter(Annexure.number == number).first()
            if not annexure:
                annexure = Annexure(
                    number=number,
                    code=f"ANNEXURE-{number:02d}",
                    title=title,
                    description=description,
                    revision="1.0",
                    active=True,
                    sort_order=number,
                    created_by_user_id=admin.id if admin else None,
                )
                db.add(annexure)
                db.flush()
                created += 1
            else:
                annexure.title = title
                annexure.description = description
                annexure.revision = annexure.revision or "1.0"
                annexure.active = True
                annexure.is_deleted = False
                annexure.sort_order = number

            ensure_department_visibility(db, annexure, departments)
            ensure_sections_and_questions(db, annexure, departments)
            ensure_template(db, annexure, admin)

        db.commit()
        print(f"Annexure seed completed: {created} new annexure(s), {len(ANNEXURE_SPECS)} total controlled annexures.")
    finally:
        db.close()


def ensure_sections_and_questions(db, annexure: Annexure, departments: list[str]) -> None:
    existing_sections = {section.title: section for section in annexure.sections}
    for section_index, (section_title, section_type, description) in enumerate(SECTION_DEFINITIONS, start=1):
        section = existing_sections.get(section_title)
        if not section:
            section = AnnexureSection(
                annexure_id=annexure.id,
                title=section_title,
                section_type=section_type,
                description=description,
                sort_order=section_index,
            )
            db.add(section)
            db.flush()
        section.description = description
        section.section_type = section_type
        section.responsible_department = departments[(section_index - 1) % len(departments)]
        section.sort_order = section_index

        existing_questions = {question.sort_order: question for question in section.questions}
        for question_index, question_text in enumerate(build_questions(annexure.number, section_type), start=1):
            department = departments[(question_index + section_index - 2) % len(departments)]
            sort_order = (section_index * 100) + question_index
            question = existing_questions.get(sort_order)
            if not question:
                question = AnnexureQuestion(
                    annexure_id=annexure.id,
                    section_id=section.id,
                    sort_order=sort_order,
                )
                db.add(question)
            question.question_text = question_text
            question.question_type = "DOCUMENT" if section_type == "DOCUMENT" else "FIELD"
            question.response_type = "PASS_FAIL"
            question.checked_by_department = department
            question.department_owner = department
            question.category = category_for_question(question_text)
            question.expected_evidence = evidence_for_section(section_type)
            question.help_text = "Verify against approved refinery startup dossier and field evidence."
            question.guidance_notes = "Use OISD, site engineering standards, MOC records, and signed inspection evidence where applicable."
            question.evidence_required = section_type in {"DOCUMENT", "FIELD"}
            question.regulatory_reference = "OISD PSSR / refinery engineering standard"
            question.required = "concession" not in question_text.lower()
            question.sequence = question_index
            question.active = True


def build_questions(number: int, section_type: str) -> list[str]:
    return ANNEXURE_QUESTION_BANK[number][section_type]


def category_for_question(question_text: str) -> str:
    text = question_text.lower()
    if "statutory" in text or "oisd" in text:
        return "Regulatory Compliance"
    if "functional" in text or "calibration" in text or "interlock" in text:
        return "Functional Test"
    if "punch" in text:
        return "Punch Point Control"
    if "evidence" in text or "uploaded" in text:
        return "Evidence Upload"
    if "safeguards" in text or "emergency" in text:
        return "Field Safety"
    return "Document Control"


def evidence_for_section(section_type: str) -> str:
    if section_type == "DOCUMENT":
        return "Approved PDF/DOCX record or signed certificate"
    if section_type == "FIELD":
        return "Geotagged image, field inspection note, or test record"
    return "Reviewer remarks, punch list extract, closure evidence, or ATP approval"


def ensure_department_visibility(db, annexure: Annexure, departments: list[str]) -> None:
    existing = {department.department_id for department in annexure.departments}
    for department in departments:
        if department not in existing:
            db.add(AnnexureDepartment(annexure_id=annexure.id, department_id=department))


def ensure_template(db, annexure: Annexure, admin: User | None) -> None:
    if db.query(AnnexureTemplate).filter(AnnexureTemplate.annexure_id == annexure.id, AnnexureTemplate.version == "1.0").first():
        return
    storage_path = Path("storage/annexure_templates") / f"{annexure.code.lower()}-v1.docx"
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    if not storage_path.exists() or not zipfile.is_zipfile(storage_path):
        write_docx_template(storage_path, annexure)
    db.add(
        AnnexureTemplate(
            annexure_id=annexure.id,
            version="1.0",
            file_name=f"{annexure.code.lower()}-{slug(annexure.title)}.docx",
            file_path=str(storage_path),
            file_size=storage_path.stat().st_size,
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            file_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            storage_path=str(storage_path),
            uploaded_by_user_id=admin.id if admin else None,
            uploaded_by=admin.id if admin else None,
            active=True,
            is_active=True,
            notes="Seeded controlled template placeholder from refinery PSSR annexure catalogue.",
        )
    )


def seed_sample_workflow(db, team_member: User | None, area_owner: User | None, admin: User | None) -> None:
    if not team_member:
        return
    pssr_id = "PSSR-VDN-ANNEXURE-SAMPLE-001"
    annexures = db.query(Annexure).order_by(Annexure.number.asc()).limit(5).all()
    for index, annexure in enumerate(annexures, start=1):
        if not db.query(AnnexureAssignment).filter(AnnexureAssignment.pssr_id == pssr_id, AnnexureAssignment.annexure_id == annexure.id).first():
            first_question = db.query(AnnexureQuestion).filter(AnnexureQuestion.annexure_id == annexure.id).order_by(AnnexureQuestion.sort_order.asc()).first()
            db.add(
                AnnexureAssignment(
                    pssr_id=pssr_id,
                    annexure_id=annexure.id,
                    question_id=first_question.id if first_question else None,
                    assigned_department=first_question.checked_by_department if first_question else "Safety",
                    assigned_to_user_id=team_member.id,
                    area_owner_user_id=area_owner.id if area_owner else None,
                    assigned_by_user_id=admin.id if admin else None,
                    status="IN_PROGRESS" if index <= 3 else "ASSIGNED",
                    priority="HIGH" if index == 1 else "MEDIUM",
                    due_date=datetime.utcnow() + timedelta(days=index + 2),
                    review_status="PENDING",
                    remarks="Seeded annexure workflow assignment for dashboard validation.",
                )
            )
    db.flush()

    sample_questions = db.query(AnnexureQuestion).join(Annexure).filter(Annexure.number.in_([1, 2, 4])).order_by(Annexure.number, AnnexureQuestion.sort_order).limit(10).all()
    for offset, question in enumerate(sample_questions):
        if db.query(AnnexureResponse).filter(AnnexureResponse.pssr_id == pssr_id, AnnexureResponse.question_id == question.id).first():
            continue
        response_value = "FAIL" if offset in {3, 7} else "PASS"
        db.add(
            AnnexureResponse(
                pssr_id=pssr_id,
                annexure_id=question.annexure_id,
                question_id=question.id,
                response=response_value,
                remarks="Seeded verification complete." if response_value == "PASS" else "Field evidence requires closure before startup.",
                attachments=[{"file_name": "seed-evidence.pdf", "file_type": "application/pdf", "storage_path": "storage/sample/seed-evidence.pdf"}],
                checked_by_user_id=team_member.id,
                checked_by_department=question.checked_by_department,
                checked_at=datetime.utcnow() - timedelta(hours=offset),
                modified_by_user_id=team_member.id,
            )
        )
        if response_value == "FAIL" and not db.query(AnnexurePunchPoint).filter(AnnexurePunchPoint.pssr_id == pssr_id, AnnexurePunchPoint.question_id == question.id).first():
            db.add(
                AnnexurePunchPoint(
                    pssr_id=pssr_id,
                    annexure_id=question.annexure_id,
                    question_id=question.id,
                    title=f"Closure required: {question.category}",
                    description=question.question_text,
                    category="A",
                    severity="HIGH",
                    status="OPEN",
                    owning_department=question.checked_by_department,
                    assigned_to_user_id=team_member.id,
                    raised_by_user_id=team_member.id,
                    due_date=datetime.utcnow() + timedelta(days=2),
                )
            )
    db.commit()


def slug(value: str) -> str:
    return "-".join("".join(character.lower() if character.isalnum() else " " for character in value).split())


def write_docx_template(path: Path, annexure: Annexure) -> None:
    def paragraph(text: str, style: str | None = None) -> str:
        style_xml = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
        return f"<w:p>{style_xml}<w:r><w:t>{html.escape(text)}</w:t></w:r></w:p>"

    def table(rows: list[list[str]]) -> str:
        output = []
        for row in rows:
            cells = "".join(f"<w:tc>{paragraph(cell)}</w:tc>" for cell in row)
            output.append(f"<w:tr>{cells}</w:tr>")
        borders = "".join(f"<w:{edge} w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"9CA3AF\"/>" for edge in ["top", "left", "bottom", "right", "insideH", "insideV"])
        return f"<w:tbl><w:tblPr><w:tblBorders>{borders}</w:tblBorders></w:tblPr>{''.join(output)}</w:tbl>"

    departments = ", ".join(sorted({department.department_id for department in annexure.departments})) or "Shared"
    content = [
        paragraph(f"{annexure.code}: {annexure.title}", "Title"),
        paragraph(f"Revision: {annexure.revision}"),
        paragraph(f"Department Visibility: {departments}"),
        paragraph(annexure.description or ""),
        table([["PSSR Number", ""], ["Unit / Area", ""], ["MOC Reference", ""], ["Prepared By", ""], ["Reviewed By", ""]]),
    ]
    for section in sorted(annexure.sections, key=lambda item: item.sort_order):
        content.append(paragraph(section.title, "Heading1"))
        content.append(paragraph(section.description or ""))
        rows = [["No.", "Checkpoint", "Response", "Remarks", "Owner", "Signature"]]
        for index, question in enumerate([item for item in section.questions if item.active], start=1):
            rows.append([str(index), question.question_text, question.response_type, "", question.department_owner or question.checked_by_department, ""])
        content.append(table(rows))
    content.append(paragraph("Approval Block", "Heading1"))
    content.append(table([["Role", "Name", "Department", "Signature", "Date"], ["Operations", "", "", "", ""], ["Safety", "", "", "", ""], ["Area Owner", "", "", "", ""]]))
    document_xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + "".join(content) + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>'
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        docx.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        docx.writestr("word/document.xml", document_xml)


if __name__ == "__main__":
    seed_annexures()
