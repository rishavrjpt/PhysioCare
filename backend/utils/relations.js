import { one } from "../config/pg.js";

// True if this doctor has an appointment with the patient, or the patient is
// enrolled in one of the doctor's programs.
export const doctorHasPatient = async (doctorId, patientId) => {
  const row = await one(
    `select (
        exists (select 1 from appointments where doctor_id = $1 and patient_id = $2)
        or exists (
          select 1 from program_enrollments pe join programs p on p.id = pe.program_id
          where p.doctor_id = $1 and pe.patient_id = $2)
      ) as ok`,
    [doctorId, patientId]
  );
  return Boolean(row?.ok);
};
