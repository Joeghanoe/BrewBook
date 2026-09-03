import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Rule } from "./Chrome";
import { categoryOf, groupOf } from "../lib/flavours";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";

export type Provenance = "extracted" | "partial" | "missing" | "edited";

/** One line of the bag ledger: a label, a tappable value that turns into an input, an optional provenance dot. */
export const Field = ({ label, value, editing, onEdit, onChange, onDone, placeholder, required, hint, provenance, keyboard }: {
  label: string; value: string; editing: boolean; onEdit: () => void; onChange: (v: string) => void; onDone: () => void;
  placeholder: string; required?: boolean; hint?: string; provenance?: Provenance; keyboard?: "default" | "numbers-and-punctuation" | "email-address";
}) => {
  const empty = value.trim() === "";
  const missing = provenance ? provenance === "missing" : empty;
  const dot = provenance === undefined ? null : provenance === "missing" ? "○" : provenance === "partial" ? "◐" : "●";
  const dotCol = provenance === "missing" ? (required ? C.rust : C.text35) : C.copper;
  return (
    <Pressable style={st.field} onPress={() => !editing && onEdit()} accessibilityRole="button">
      <Text style={st.k}>{label}</Text>
      {editing ? (
        <TextInput autoFocus value={value} placeholder={placeholder} placeholderTextColor={C.text35} onChangeText={onChange}
          onBlur={onDone} onSubmitEditing={onDone} returnKeyType="done" keyboardType={keyboard ?? "default"} autoCapitalize="none" style={st.input} />
      ) : (
        <Text style={[st.v, missing && { color: required ? C.rustLight : C.text35 }]}>{value || (required ? hint : "—")}</Text>
      )}
      {dot && <Text style={{ fontSize: 11, color: dotCol }}>{dot}</Text>}
    </Pressable>
  );
};

/** Declared notes: the roaster's words, mapped to a wheel category where the lexicon knows them, quoted where it does not. */
export const Notes = ({ notes, setNotes, categories }: { notes: string[]; setNotes: (n: string[]) => void; categories?: Map<string, string | null> }) => {
  const [newNote, setNewNote] = useState("");
  const addNote = () => { const n = newNote.trim(); if (n && !notes.includes(n)) setNotes([...notes, n]); setNewNote(""); };
  return (
    <>
      <Rule label="DECLARED NOTES" style={{ marginTop: 18 }} />
      <View style={st.chips}>
        {notes.map((n) => {
          const cat = categories?.get(n) ?? (groupOf(n) ? categoryOf(n) : null);
          return (
            <Pressable key={n} style={[st.noteChip, !cat && st.noteQuote]} onPress={() => setNotes(notes.filter((x) => x !== n))} accessibilityLabel="Remove">
              <Text style={[st.noteText, !cat && { color: C.text70 }]}>{cat ? n : `"${n}"`}</Text>
              {cat && <Text style={st.noteCat}>→ {cat}</Text>}
            </Pressable>
          );
        })}
        <View style={st.noteAdd}>
          <TextInput value={newNote} placeholder="+ add a note" placeholderTextColor={C.copperLight} onChangeText={setNewNote} onBlur={addNote} onSubmitEditing={addNote} blurOnSubmit={false} style={st.noteInput} />
        </View>
      </View>
    </>
  );
};

const st = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(194, 144, 94, 0.18)", width: "100%" },
  k: { ...c(700, 10, 2, C.text55), width: 86 },
  v: { ...g(500, 15), flex: 1 },
  input: { ...g(500, 15), flex: 1, borderBottomWidth: 1, borderBottomColor: C.copper55, paddingVertical: 0, paddingBottom: 2, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 11, paddingBottom: 16 },
  noteChip: { height: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, backgroundColor: C.copper16, borderWidth: 1, borderColor: C.copper60 },
  noteQuote: { backgroundColor: "transparent", borderStyle: "dashed", borderColor: C.copper45 },
  noteText: g(500, 13),
  noteCat: c(700, 9, 0, C.copperLight),
  noteAdd: { height: 40, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderStyle: "dashed", borderColor: C.copper45 },
  noteInput: { ...g(500, 13), width: 120, paddingVertical: 0 },
});
