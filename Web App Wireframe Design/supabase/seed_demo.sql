-- Demo data for testing the UI with realistic content.
-- Change `uid` to the account you want to fill, then run this in the Supabase SQL editor.
-- It does nothing if that user already has applications, so it is safe to re-run.
do $$
declare
  uid uuid := 'b2122781-cc49-4eaa-b267-4cb38810a774';  -- pbreinga@villanova.edu
  acme uuid; acme_data uuid; techstart uuid; meridian uuid; bloom uuid;
  nexus uuid; clearpath uuid; vertex uuid;
  sarah uuid; marcus uuid; jordan uuid; priya uuid; alex uuid; dana uuid;
begin
  if not exists (select 1 from auth.users where id = uid) then
    raise notice 'No such user - nothing seeded.';
    return;
  end if;
  if exists (select 1 from public.applications where user_id = uid) then
    raise notice 'This account already has applications - nothing seeded.';
    return;
  end if;

  -- Applications. created_at/updated_at are staggered so the dashboard activity feed looks real.
  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'Acme Corp', 'Software Engineer Intern', 'interviewing', current_date - 44, current_date + 10,
          'https://acmecorp.com/careers/123', 'San Francisco, CA (Hybrid)', '$42/hr',
          'Referral from alumni network. Recruiter is Sarah Chen. Technical screen went well - focus on system design next round.',
          '#3B82F6', 'AC', now() - interval '40 days', now() - interval '1 day')
  returning id into acme;

  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'Acme Corp', 'Data Engineering Intern', 'applied', current_date - 9, current_date + 17,
          'https://acmecorp.com/careers/188', 'San Francisco, CA (Hybrid)', '$40/hr',
          'Second team at Acme. Sarah Chen referred me here too after the first interview.',
          '#3B82F6', 'AC', now() - interval '9 days', now() - interval '9 days')
  returning id into acme_data;

  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'TechStart Inc.', 'Product Design Intern', 'applied', current_date - 5, current_date + 17,
          'https://techstart.io/jobs/design-intern', 'New York, NY (On-site)', '$38/hr',
          'Applied through Handshake. Portfolio submitted. Waiting to hear back on initial screen.',
          '#8B5CF6', 'TS', now() - interval '5 days', now() - interval '5 days')
  returning id into techstart;

  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'Meridian Health', 'Data Analyst Intern', 'applied', current_date - 3, current_date + 5,
          'https://meridianhealth.org/careers', 'Boston, MA (Remote)', '$30/hr',
          'Requires Python and SQL proficiency. Health tech experience a plus - mentioned research project in cover letter.',
          '#10B981', 'MH', now() - interval '3 days', now() - interval '3 days')
  returning id into meridian;

  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'Bloom Analytics', 'Frontend Engineer Intern', 'wishlist', null, current_date + 38,
          'https://bloomanalytics.com/jobs/frontend', 'Austin, TX (Hybrid)', '$44/hr',
          'Strong React + TypeScript focus. Found on LinkedIn. Need to tailor resume before applying.',
          '#F59E0B', 'BA', now() - interval '1 day', now() - interval '1 day')
  returning id into bloom;

  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'Nexus Systems', 'Backend Developer Intern', 'rejected', current_date - 55, current_date - 29,
          'https://nexussystems.com/careers', 'Seattle, WA (On-site)', '$40/hr',
          'Rejection received after final round. Ask for feedback from recruiter. Good practice for system design questions.',
          '#EF4444', 'NS', now() - interval '50 days', now() - interval '4 days')
  returning id into nexus;

  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'ClearPath Labs', 'ML Engineer Intern', 'offer', current_date - 70, current_date - 53,
          'https://clearpathlabs.ai/jobs', 'Remote', '$52/hr',
          'Offer received! Deadline to accept is two weeks out. Compare with Acme outcome before deciding.',
          '#06B6D4', 'CL', now() - interval '60 days', now() - interval '2 hours')
  returning id into clearpath;

  insert into public.applications (user_id, company, position, status, applied_date, deadline, job_url, location, salary, notes, logo_color, logo_initials, created_at, updated_at)
  values (uid, 'Vertex Capital', 'Quantitative Analyst Intern', 'wishlist', null, current_date + 52,
          'https://vertexcap.com/internships', 'Chicago, IL (On-site)', '$60/hr',
          'Very competitive. Need to prep probability and stats heavily. Reach out to alumni at the firm first.',
          '#6366F1', 'VC', now() - interval '6 hours', now() - interval '6 hours')
  returning id into vertex;

  -- Interview stages
  insert into public.interview_stages (user_id, application_id, name, date, notes, completed) values
    (uid, acme, 'Recruiter Screen', current_date - 36, '30 min call. Discussed team, culture, timeline.', true),
    (uid, acme, 'Technical Phone Screen', current_date - 28, 'LeetCode medium - sliding window and DP. Passed.', true),
    (uid, acme, 'Virtual Onsite', current_date + 7, '4 rounds: 2x coding, 1x system design, 1x behavioral.', false),
    (uid, meridian, 'Intro Call', current_date + 2, 'Screening call with the data team lead.', false),
    (uid, nexus, 'Recruiter Screen', current_date - 49, 'Went well.', true),
    (uid, nexus, 'Technical Interview', current_date - 40, 'Database design and concurrency.', true),
    (uid, clearpath, 'Intro Call', current_date - 65, 'Culture fit and research interests.', true),
    (uid, clearpath, 'ML Coding Assessment', current_date - 57, 'PyTorch model fine-tuning task.', true),
    (uid, clearpath, 'Final Interview', current_date - 49, 'Research presentation and Q&A.', true);

  -- Contacts
  insert into public.contacts (user_id, name, role, company, email, phone, notes) values
    (uid, 'Sarah Chen', 'University Recruiter', 'Acme Corp', 's.chen@acmecorp.com', '(415) 555-0118',
     'Met at the Villanova career fair. Referred me to both the SWE and data teams. Prefers email over LinkedIn.')
  returning id into sarah;

  insert into public.contacts (user_id, name, role, company, email, phone, notes) values
    (uid, 'Marcus Webb', 'Hiring Manager, Platform', 'Acme Corp', 'm.webb@acmecorp.com', '',
     'Runs the platform team. Asked about my telemetry dashboard project. Send a thank-you note after the onsite.')
  returning id into marcus;

  insert into public.contacts (user_id, name, role, company, email, phone, notes) values
    (uid, 'Jordan Lee', 'Data Team Lead', 'Meridian Health', 'jordan.lee@meridianhealth.org', '',
     'Villanova alum, class of 2019. Offered to review my resume before the intro call.')
  returning id into jordan;

  insert into public.contacts (user_id, name, role, company, email, phone, notes) values
    (uid, 'Priya Nair', 'Talent Acquisition', 'Nexus Systems', 'priya@nexussystems.com', '',
     'Said to reapply next cycle. Worth asking for specific feedback on the system design round.')
  returning id into priya;

  insert into public.contacts (user_id, name, role, company, email, phone, notes) values
    (uid, 'Alex Rivera', 'Research Lead', 'ClearPath Labs', 'alex.r@clearpathlabs.ai', '(206) 555-0193',
     'Would be my manager. Very responsive. Ask about the return-offer path before accepting.')
  returning id into alex;

  -- Someone with no application yet: the "want to reach out to" case
  insert into public.contacts (user_id, name, role, company, email, phone, notes) values
    (uid, 'Dana Whitfield', 'Quant Researcher', 'Vertex Capital', 'dwhitfield@vertexcap.com', '',
     'Villanova alum on the quant team. Introduced through Professor Shaw. Have not reached out yet - draft an email this week.')
  returning id into dana;

  -- Contact links. Sarah covers both Acme applications.
  insert into public.application_contacts (user_id, application_id, contact_id) values
    (uid, acme, sarah),
    (uid, acme_data, sarah),
    (uid, acme, marcus),
    (uid, meridian, jordan),
    (uid, nexus, priya),
    (uid, clearpath, alex);

  -- Tasks
  insert into public.tasks (user_id, application_id, text, done, due) values
    (uid, acme, 'Prepare system design answers for the Acme onsite', false, current_date + 4),
    (uid, acme, 'Send thank-you email to Marcus Webb', false, current_date + 1),
    (uid, vertex, 'Email Dana Whitfield for a referral at Vertex', false, current_date + 3),
    (uid, bloom, 'Tailor resume for Bloom Analytics before applying', false, current_date + 8),
    (uid, nexus, 'Request feedback from the Nexus recruiter', false, current_date + 2),
    (uid, clearpath, 'Email ClearPath Labs for offer letter details', true, current_date - 2);

  insert into public.calendar_events (user_id, application_id, title, date, start_time, notes) values
    (uid, acme, 'Mock interview with career services', current_date + 3, '15:00', 'Bartley Hall, room 2010. Focus on system design.'),
    (uid, vertex, 'Coffee chat with Dana Whitfield', current_date + 6, '10:30', 'Holy Grounds. Ask about the quant team structure and summer projects.'),
    (uid, null, 'Villanova fall career fair', current_date + 12, '11:00', 'Bring 15 printed resumes. Target: Bloom Analytics and Meridian Health booths.'),
    (uid, clearpath, 'Decision deadline for ClearPath offer', current_date + 9, '17:00', 'Must accept or decline by end of day.');

  raise notice 'Seeded demo data.';
end $$;
