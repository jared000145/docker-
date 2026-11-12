import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useInstitution } from "@/hooks/useInstitution";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AcademicYearContextType {
  currentYear: string;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: string[];
  isViewingHistory: boolean;
  isStudent: boolean;
  isRedoublant: boolean;
  previousYearFailedSubjectIds: string[];
  selectedYearLevel: string | null;
  currentLevel: string | null;
}

const formatLevel = (level?: string | null) => {
  if (!level) return null;
  const map: Record<string, string> = {
    L1: "Licence 1", L2: "Licence 2", L3: "Licence 3",
    M1: "Master 1", M2: "Master 2", D1: "Doctorat 1", D2: "Doctorat 2", D3: "Doctorat 3",
  };
  return map[level.toUpperCase()] || level;
};

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export const AcademicYearProvider = ({ children }: { children: ReactNode }) => {
  const { institution } = useInstitution();
  const { user } = useAuth();
  const currentYear = institution?.academic_year || "2025-2026";
  const [selectedYear, setSelectedYearState] = useState(currentYear);
  const yearStorageKey='rectorplus:year:'+user?.id+':'+institution?.id;
  const setSelectedYear=(year:string)=>{setSelectedYearState(year);try{sessionStorage.setItem(yearStorageKey,year);}catch{}};

  // Check if user is a student (role = 'user')
  const { data: userRole } = useQuery({
    queryKey: ["user-role-type", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      const roles = (data || []).map(d => d.role);
      if (roles.includes("super_admin")) return "super_admin";
      if (roles.includes("admin")) return "admin";
      if (roles.includes("professor")) return "professor";
      return "user";
    },
    enabled: !!user,
  });

  const isStudent = userRole === "user";

  // Check if student is redoublant (current year history has status=redoublement)
  const { data: currentYearHistory } = useQuery({
    queryKey: ["student-current-year-history", user?.id, currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_year_history")
        .select("*")
        .eq("user_id", user!.id)
        .eq("academic_year", currentYear)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isStudent,
  });

  const isRedoublant = isStudent && currentYearHistory?.status === "redoublement";

  // For redoublants: get previous year's failed subject IDs (ue_to_retake_ids)
  const getPreviousYear = (year: string) => {
    const [start] = year.split("-").map(Number);
    return `${start - 1}-${start}`;
  };
  const previousYear = getPreviousYear(currentYear);

  const { data: previousYearHistory } = useQuery({
    queryKey: ["student-previous-year-history", user?.id, previousYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_year_history")
        .select("ue_to_retake_ids")
        .eq("user_id", user!.id)
        .eq("academic_year", previousYear)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isStudent && isRedoublant,
  });

  const previousYearFailedSubjectIds: string[] = (isRedoublant && previousYearHistory?.ue_to_retake_ids) || [];

  const isStaff = userRole === "admin" || userRole === "super_admin" || userRole === "professor";
  const institutionId = institution?.id;

  // ÉTUDIANT: années où il a des données personnelles + niveau par année
  const { data: studentHistoryRows = [] } = useQuery({
    queryKey: ["student-history-years", user?.id],
    queryFn: async () => {
      const [hist,registrations] = await Promise.all([supabase.from('student_year_history').select('academic_year,level').eq('user_id',user!.id),supabase.from('student_years').select('academic_year,niveau').eq('user_id',user!.id)]);
      if(hist.error||registrations.error)throw hist.error||registrations.error;
      const rows=new Map((hist.data||[]).map(row=>[row.academic_year,row]));for(const row of registrations.data||[])rows.set(row.academic_year,{academic_year:row.academic_year,level:row.niveau});return [...rows.values()];
    },
    enabled: !!user && isStudent,
  });
  const studentHistoryYears = studentHistoryRows.map((d: any) => d.academic_year);

  const { data: studentGradeYears = [] } = useQuery({
    queryKey: ["student-grade-years", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("academic_year")
        .eq("user_id", user!.id);
      return [...new Set((data || []).map(d => d.academic_year))];
    },
    enabled: !!user && isStudent,
  });

  // ADMIN/PROF/SUPER_ADMIN: toutes les années existantes dans leur institution
  const { data: institutionYears = [] } = useQuery({
    queryKey: ["institution-all-years", institutionId],
    queryFn: async () => {
      const years = new Set<string>();
      const [histRes, gradesRes, rattRes, payRes,annualRes,schoolRes] = await Promise.all([
        supabase.from("student_year_history").select("academic_year").not("academic_year", "is", null),
        supabase.from("grades").select("academic_year").eq("institution_id", institutionId!),
        supabase.from("rattrapages").select("academic_year").not("academic_year", "is", null),
        supabase.from("payments").select("academic_year").eq("institution_id", institutionId!),
        supabase.from('student_years').select('academic_year').eq('institution_id',institutionId!),
        supabase.from('grades_trimestre').select('academic_year').eq('institution_id',institutionId!),
      ]);
      (histRes.data || []).forEach((d: any) => d.academic_year && years.add(d.academic_year));
      (gradesRes.data || []).forEach((d: any) => d.academic_year && years.add(d.academic_year));
      (rattRes.data || []).forEach((d: any) => d.academic_year && years.add(d.academic_year));
      (payRes.data || []).forEach((d: any) => d.academic_year && years.add(d.academic_year));
      [...(annualRes.data||[]),...(schoolRes.data||[])].forEach(d=>d.academic_year&&years.add(d.academic_year));
      return Array.from(years);
    },
    enabled: !!user && isStaff && !!institutionId,
  });

  const allCollectedYears = isStaff ? institutionYears : [...studentHistoryYears, ...studentGradeYears];
  const currentYearStart = Number(currentYear.split("-")[0]);
  const isAllowedAcademicYear = (year: string) => {
    const [start, end] = year.split("-").map(Number);
    return Boolean(start && end && end === start + 1 && start <= currentYearStart);
  };
  const availableYears = [...new Set([currentYear, ...allCollectedYears])]
    .filter(Boolean)
    .filter(isAllowedAcademicYear)
    .sort((a, b) => Number(b.split("-")[0]) - Number(a.split("-")[0]));

  // Sync selected year when institution loads
  useEffect(() => {
    if(currentYear){let remembered:string|null=null;try{remembered=sessionStorage.getItem(yearStorageKey);}catch{}const [start,end]=(remembered||'').split('-').map(Number);setSelectedYearState(start&&end===start+1&&start<=Number(currentYear.split('-')[0])?remembered!:currentYear);}
  }, [currentYear,yearStorageKey]);

  const isViewingHistory = selectedYear !== currentYear;

  // Niveau correspondant à l'année sélectionnée (étudiant uniquement)
  const selectedYearLevel = isStudent
    ? formatLevel(
        (studentHistoryRows as any[]).find((r) => r.academic_year === selectedYear)?.level
        || (selectedYear === currentYear ? (currentYearHistory as any)?.level : null)
      )
    : null;
  const currentLevel = isStudent ? formatLevel((currentYearHistory as any)?.level) : null;

  return (
    <AcademicYearContext.Provider value={{ currentYear, selectedYear, setSelectedYear, availableYears, isViewingHistory, isStudent, isRedoublant, previousYearFailedSubjectIds, selectedYearLevel, currentLevel }}>
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = () => {
  const context = useContext(AcademicYearContext);
  if (!context) throw new Error("useAcademicYear must be used within AcademicYearProvider");
  return context;
};
