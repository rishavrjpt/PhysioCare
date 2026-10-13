import Appointment from "../models/Appointment.js";
import Program from "../models/Program.js";
import User from "../models/User.js";

// True if this doctor has an appointment with the patient, or the patient is
// enrolled in one of the doctor's programs.
export const doctorHasPatient = async (doctorId, patientId) => {
  const appt = await Appointment.exists({ doctorId, patientId });
  if (appt) return true;
  const programIds = await Program.find({ doctorId }).distinct("_id");
  if (programIds.length === 0) return false;
  const enrolled = await User.exists({ _id: patientId, enrolledPrograms: { $in: programIds } });
  return Boolean(enrolled);
};
