-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.train_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_data ENABLE ROW LEVEL SECURITY;

-- Create function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.profiles 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin' 
    FROM public.profiles 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is operator or admin
CREATE OR REPLACE FUNCTION public.is_operator_or_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('operator', 'admin') 
    FROM public.profiles 
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles table policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- Train data policies
CREATE POLICY "Authenticated users can view train data" ON public.train_data
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Operators and admins can insert train data" ON public.train_data
  FOR INSERT WITH CHECK (is_operator_or_admin(auth.uid()));

CREATE POLICY "Operators and admins can update train data" ON public.train_data
  FOR UPDATE USING (is_operator_or_admin(auth.uid()));

CREATE POLICY "Only admins can delete train data" ON public.train_data
  FOR DELETE USING (is_admin(auth.uid()));

-- Conflicts table policies
CREATE POLICY "Authenticated users can view conflicts" ON public.conflicts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert conflicts" ON public.conflicts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Operators and admins can update conflicts" ON public.conflicts
  FOR UPDATE USING (is_operator_or_admin(auth.uid()));

CREATE POLICY "Only admins can delete conflicts" ON public.conflicts
  FOR DELETE USING (is_admin(auth.uid()));

-- Recommendations table policies
CREATE POLICY "Authenticated users can view recommendations" ON public.recommendations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert recommendations" ON public.recommendations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Operators and admins can update recommendations" ON public.recommendations
  FOR UPDATE USING (is_operator_or_admin(auth.uid()));

CREATE POLICY "Users can update recommendations assigned to them" ON public.recommendations
  FOR UPDATE USING (assigned_to = auth.uid());

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "No one can update audit logs" ON public.audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "Only admins can delete old audit logs" ON public.audit_logs
  FOR DELETE USING (is_admin(auth.uid()) AND created_at < NOW() - INTERVAL '1 year');

-- Scenarios table policies
CREATE POLICY "Users can view their own scenarios" ON public.scenarios
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Admins can view all scenarios" ON public.scenarios
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Users can view public scenarios" ON public.scenarios
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create scenarios" ON public.scenarios
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own scenarios" ON public.scenarios
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Admins can update all scenarios" ON public.scenarios
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Users can delete their own scenarios" ON public.scenarios
  FOR DELETE USING (created_by = auth.uid());

CREATE POLICY "Admins can delete all scenarios" ON public.scenarios
  FOR DELETE USING (is_admin(auth.uid()));

-- Energy data policies
CREATE POLICY "Authenticated users can view energy data" ON public.energy_data
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert energy data" ON public.energy_data
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Operators and admins can update energy data" ON public.energy_data
  FOR UPDATE USING (is_operator_or_admin(auth.uid()));

CREATE POLICY "Only admins can delete energy data" ON public.energy_data
  FOR DELETE USING (is_admin(auth.uid()));

-- Create function to log user actions
CREATE OR REPLACE FUNCTION public.log_user_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'user-agent'
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for audit logging
CREATE TRIGGER audit_profiles_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_action();

CREATE TRIGGER audit_train_data_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.train_data
  FOR EACH ROW EXECUTE FUNCTION public.log_user_action();

CREATE TRIGGER audit_conflicts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.conflicts
  FOR EACH ROW EXECUTE FUNCTION public.log_user_action();

CREATE TRIGGER audit_recommendations_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.log_user_action();

CREATE TRIGGER audit_scenarios_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.log_user_action();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'viewer', -- Default role
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to clean up old data
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete audit logs older than 2 years
  DELETE FROM public.audit_logs 
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  -- Delete old train data (keep last 30 days)
  DELETE FROM public.train_data 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Delete resolved conflicts older than 7 days
  DELETE FROM public.conflicts 
  WHERE status = 'resolved' AND updated_at < NOW() - INTERVAL '7 days';
  
  -- Delete old energy data (keep last 90 days)
  DELETE FROM public.energy_data 
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_train_data_timestamp ON public.train_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON public.conflicts(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_scenarios_created_by ON public.scenarios(created_by);
CREATE INDEX IF NOT EXISTS idx_scenarios_is_public ON public.scenarios(is_public);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Revoke dangerous permissions
REVOKE ALL ON auth.users FROM authenticated;
REVOKE ALL ON auth.sessions FROM authenticated;
