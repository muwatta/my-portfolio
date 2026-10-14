update public.academy_assignments assignment
set instructions = 'The program already has a distance value of 60. Do not read input. Add if, else if, and else so it prints "slow" when the distance is less than 30, "medium" when it is 30 through 99, and "fast" when it is 100 or more. Run it: the output should be medium. To try the other answers, temporarily change distance to 10 and then 120; set it back to 60 before submitting.',
    starter_code = E'#include <iostream>\nusing namespace std;\n\nint main() {\n    int distance = 60;\n    // TODO: print \"slow\" when distance is below 30\n    // TODO: otherwise print \"medium\" when distance is below 100\n    // TODO: otherwise print \"fast\"\n    return 0;\n}',
    automated_tests = E'[{"name":"distance of 60 selects medium","input":[],"expected":"medium"}]'::jsonb,
    updated_at = now()
from public.academy_courses course
where assignment.course_id = course.id
  and course.slug = 'cpp-embedded-robotics'
  and assignment.title = 'C++ Week 3: choose a motor speed';

notify pgrst, 'reload schema';
