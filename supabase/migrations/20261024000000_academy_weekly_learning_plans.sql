update public.academy_courses
set description = case slug
  when 'python-for-ai-machine-learning' then 'An 11-week practical Python and machine-learning course for secondary school students, with 5–7 hours of guided study each week.'
  when 'cpp-embedded-robotics' then 'A 24-week practical programme covering C++, Arduino, ESP32, sensors, actuators, robotics, and a capstone engineering project, with 5–7 hours of guided study each week.'
  else description
end,
updated_at = now()
where slug in ('python-for-ai-machine-learning', 'cpp-embedded-robotics');

update public.academy_lessons lessons
set content = lessons.content || case course.slug
  when 'python-for-ai-machine-learning' then jsonb_build_object(
    'weekly_plan', jsonb_build_array(
      jsonb_build_object('minutes', 20, 'label', 'Warm-up', 'activity', 'Predict the output of a short Python example and explain your prediction.'),
      jsonb_build_object('minutes', 60, 'label', 'Concept studio', 'activity', 'Read the main lesson, run one example, and write the key idea in your own words.'),
      jsonb_build_object('minutes', 75, 'label', 'Hands-on lab', 'activity', 'Complete the week''s Lab, changing the starter data and testing at least two cases.'),
      jsonb_build_object('minutes', 45, 'label', 'Bug hunt', 'activity', 'Find the intentional bug, explain the error, and repair it one line at a time.'),
      jsonb_build_object('minutes', 90, 'label', 'Creative mission', 'activity', 'Build the week''s Mission, add your own twist, and run a final showcase test.'),
      jsonb_build_object('minutes', 30, 'label', 'Show and reflect', 'activity', 'Share your result, review the hints you used, and answer the reflection question.')
    ),
    'weekly_minutes', 320
  )
  when 'cpp-embedded-robotics' then jsonb_build_object(
    'weekly_plan', jsonb_build_array(
      jsonb_build_object('minutes', 20, 'label', 'Warm-up and safety', 'activity', 'Review the previous build, check power and connections, and state the week''s goal.'),
      jsonb_build_object('minutes', 70, 'label', 'Concept lesson', 'activity', 'Study the engineering idea, annotate the example, and connect it to a real device or system.'),
      jsonb_build_object('minutes', 100, 'label', 'Checkpoint build', 'activity', 'Complete the checkpoint build, test each part separately, and record one measured result.'),
      jsonb_build_object('minutes', 45, 'label', 'Guided practice', 'activity', 'Work through the hands-on activities and answer the three practice questions.'),
      jsonb_build_object('minutes', 55, 'label', 'Challenge sprint', 'activity', 'Extend the build with the challenge, tune one parameter, and document the result.'),
      jsonb_build_object('minutes', 30, 'label', 'Demo and reflect', 'activity', 'Explain your SENSE → THINK → ACT flow, log one fix, and set a next-week improvement.')
    ),
    'weekly_minutes', 320
  )
  else jsonb_build_object('weekly_plan', jsonb_build_array(), 'weekly_minutes', 0)
end
from public.academy_weeks weeks
join public.academy_courses course on course.id = weeks.course_id
where lessons.week_id = weeks.id
  and course.slug in ('python-for-ai-machine-learning', 'cpp-embedded-robotics');
