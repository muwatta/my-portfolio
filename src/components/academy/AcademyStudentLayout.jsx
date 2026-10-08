import AcademyLayout from "./AcademyLayout";
import StudentSectionNav from "./StudentSectionNav";

export default function AcademyStudentLayout() {
  return (
    <AcademyLayout
      workspace="student"
      aboveOutlet={<StudentSectionNav />}
    />
  );
}
