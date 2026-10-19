-- Demo career log for testing the Career log, Brag doc and Career coach pages.
-- Change `uid` to the account you want to fill, then run this in the Supabase SQL editor, or:
--   npx supabase db query --linked -f supabase/seed_demo_career_log.sql
-- It does nothing if that user already has career log entries, so it is safe to re-run.
-- Entries about offers, interviews and rejections link to the account's own applications in that status,
-- so it works on any account; without a matching application the entry is just left unlinked.
do $$
declare
  uid uuid := 'de836e0b-29b6-4576-bcf2-66af05e3e625';  -- cmarinas1209@gmail.com
  offer_app uuid; offer_co text;
  interview_app uuid; interview_co text;
  closed_app uuid; closed_co text;
begin
  if not exists (select 1 from auth.users where id = uid) then
    raise notice 'No such user - nothing seeded.';
    return;
  end if;
  if exists (select 1 from public.career_log_entries where user_id = uid) then
    raise notice 'This account already has career log entries - nothing seeded.';
    return;
  end if;

  select id, company into offer_app, offer_co from public.applications
    where user_id = uid and status = 'offer' order by updated_at desc limit 1;
  select id, company into interview_app, interview_co from public.applications
    where user_id = uid and status = 'interviewing' order by updated_at desc limit 1;
  select id, company into closed_app, closed_co from public.applications
    where user_id = uid and status = 'rejected' order by updated_at desc limit 1;

  -- Spread over ~14 months so the brag doc has several months, quarters and two years to group.
  -- created_at follows the date so same-day ordering looks natural.
  insert into public.career_log_entries (user_id, category, title, details, impact, date, application_id, created_at) values
    -- Accomplishments
    (uid, 'accomplishment', 'Cut the club website''s load time by two thirds',
     'Compressed and lazy-loaded the event photo gallery, removed an unused UI framework and moved hosting to a CDN.',
     'Lighthouse performance score went from 58 to 94; page load from 4.1s to 1.3s', current_date - 6, null, now() - interval '6 days'),
    (uid, 'accomplishment', 'Placed 2nd at the fall campus hackathon',
     'Led a team of four building a dining-hall crowd tracker from Wi-Fi access point counts. I owned the backend and the demo.',
     '2nd of 38 teams, plus the "Best use of data" prize', current_date - 20, null, now() - interval '20 days'),
    (uid, 'accomplishment', 'Automated the research lab''s weekly results report',
     'Replaced a hand-built spreadsheet with a Python script that pulls experiment results, makes the charts and emails a PDF.',
     'Saves the group about 3 hours every week', current_date - 48, null, now() - interval '48 days'),
    (uid, 'accomplishment', 'Shipped the internal metrics dashboard during my summer internship',
     'Built it end to end in React and SQL with one other intern: requirements interviews, data model, UI and the rollout demo.',
     'Used daily by 40+ analysts; replaced three separate weekly reports', current_date - 95, null, now() - interval '95 days'),
    (uid, 'accomplishment', 'Found and fixed a pipeline bug that double-counted orders',
     'Traced a mismatch between two reports to a join on a non-unique key, wrote the fix and a regression test.',
     'Corrected the revenue figures used in the Q2 leadership review', current_date - 130, null, now() - interval '130 days'),
    (uid, 'accomplishment', 'Ran weekly review sessions as a Data Structures TA',
     'Wrote practice problems for each session and held extra office hours before exams.',
     'Average attendance of 35 students; section exam average rose 6 points', current_date - 200, null, now() - interval '200 days'),
    (uid, 'accomplishment', 'Raised sponsorship money for the robotics team',
     'Cold-emailed 25 local companies and pitched to four of them with the team captain.',
     '$4,200 raised, enough to cover competition travel', current_date - 300, null, now() - interval '300 days'),

    -- Projects
    (uid, 'project', 'Internship tracker web app',
     'React, TypeScript and Supabase. Built the application board, calendar, career log and an AI career coach with a teammate.',
     'Used by 30 classmates during fall recruiting', current_date - 12, null, now() - interval '12 days'),
    (uid, 'project', 'Course planner Chrome extension',
     'Overlays professor ratings and seat counts on the registration page. Vanilla JS with a small serverless backend.',
     '200+ installs in the first two weeks of registration', current_date - 60, null, now() - interval '60 days'),
    (uid, 'project', 'Sentiment analysis of product reviews',
     'Class project: cleaned 50k reviews, compared logistic regression with a fine-tuned DistilBERT, and wrote up the error analysis.',
     '0.89 F1 with DistilBERT, up from 0.81 with the baseline', current_date - 150, null, now() - interval '150 days'),
    (uid, 'project', 'Personal finance tracker for iOS',
     'SwiftUI app that imports bank CSVs and categorizes spending. Built to learn Swift over winter break.',
     '', current_date - 260, null, now() - interval '260 days'),
    (uid, 'project', 'Robotics team telemetry dashboard',
     'Live charts of motor current and battery voltage during matches, streamed from the robot over websockets.',
     'Helped the team catch a failing motor before the regional final', current_date - 340, null, now() - interval '340 days'),

    -- Feedback
    (uid, 'feedback', 'Strong feedback after the technical interview' || coalesce(' at ' || interview_co, ''),
     'Recruiter said my explanation of trade-offs in the system design question was the clearest they heard that day. Next round: focus on testing strategy.',
     '', current_date - 10, interview_app, now() - interval '10 days'),
    (uid, 'feedback', 'Interview feedback' || coalesce(' from ' || closed_co, ''),
     'Coding was solid; they wanted me to talk through edge cases earlier and ask more clarifying questions before designing.',
     '', current_date - 30, closed_app, now() - interval '30 days'),
    (uid, 'feedback', 'Manager''s end-of-internship review',
     'Praised ownership of the dashboard project and clear written status updates. Growth area: ask for help sooner when blocked.',
     'Rated "exceeds expectations"', current_date - 100, null, now() - interval '100 days'),
    (uid, 'feedback', 'Professor''s comments on my capstone proposal',
     'Called the problem statement "unusually well scoped" and asked to use it as an example for next year''s class.',
     '', current_date - 180, null, now() - interval '180 days'),
    (uid, 'feedback', 'Peer review from hackathon teammates',
     'Teammates said I kept the scope realistic and made sure everyone had a part of the demo to present.',
     '', current_date - 290, null, now() - interval '290 days'),

    -- Skills
    (uid, 'skill', 'Supabase row-level security',
     'Wrote policies so every table is scoped to its owner, including a join table that checks both sides.', '',
     current_date - 15, null, now() - interval '15 days'),
    (uid, 'skill', 'Docker and Docker Compose',
     'Containerized the lab''s analysis scripts so new students can run them without setup.', '',
     current_date - 70, null, now() - interval '70 days'),
    (uid, 'skill', 'SQL window functions',
     'Learned them on the job for running totals and period-over-period comparisons in the dashboard.', '',
     current_date - 160, null, now() - interval '160 days'),
    (uid, 'skill', 'Figma prototyping',
     'Took a short course and prototyped the course planner extension before writing code.', '',
     current_date - 240, null, now() - interval '240 days'),

    -- Milestones
    (uid, 'milestone', 'Received an internship offer' || coalesce(' from ' || offer_co, ''),
     'Offer came a week after the final round.', '',
     current_date - 45, offer_app, now() - interval '45 days'),
    (uid, 'milestone', 'Completed my summer internship', '', '',
     current_date - 110, null, now() - interval '110 days'),
    (uid, 'milestone', 'AWS Certified Cloud Practitioner', 'Passed on the first attempt.', '',
     current_date - 210, null, now() - interval '210 days'),
    (uid, 'milestone', 'Dean''s List, fall semester', '', '',
     current_date - 380, null, now() - interval '380 days');

  raise notice 'Seeded 25 career log entries.';
end $$;
